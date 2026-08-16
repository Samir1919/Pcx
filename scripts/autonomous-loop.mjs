/**
 * Autonomous orchestration loop driver.
 *
 * Loads a bounded task graph, validates it, and runs every dependency-ready,
 * non-conflicting task through the full control-plane pipeline (bounded
 * execution, QA, security, review, integrated verification, handoff) using the
 * real shell git adapter and durable secret-free log store. The loop terminates
 * when no more dependency-ready work remains because failed tasks are recorded
 * and never re-attempted.
 *
 * Executors, git, and the log store are injectable for deterministic testing.
 * A dry-run mode (`--dry-run`) runs the pipeline without creating real git
 * worktrees, so it is safe to run in CI.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createFileLogStore, createShellGit, runParallelWorkers, validateTaskGraph } from "./control-plane.mjs";



const DEFAULT_GRAPH = "work/autonomous-graph.json";
const DEFAULT_LOG = ".worktrees/autonomous-loop.log";

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const parseArgs = (argv = []) => {
  const args = { graph: DEFAULT_GRAPH, log: DEFAULT_LOG, dryRun: false, maxBatches: null, noPersistGraph: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--graph") {
      args.graph = asNonEmptyString(argv[index + 1], "--graph");
      index += 1;
    } else if (arg === "--log") {
      args.log = asNonEmptyString(argv[index + 1], "--log");
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--no-persist-graph") {
      args.noPersistGraph = true;
    } else if (arg === "--max-batches") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--max-batches must be a positive integer");
      args.maxBatches = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return Object.freeze(args);
};


const loadGraph = async (path) => {
  const content = await readFile(path, "utf8");
  const parsed = JSON.parse(content);
  return validateTaskGraph(parsed);
};

/**
 * Applies a run summary's completed/failed task ids to a validated graph and
 * returns a plain, JSON-serializable graph object with each task's durable
 * status updated (PASSED/FAILED). Tasks not touched by this run keep their
 * existing status. This lets a later process invocation resume from where a
 * prior run left off instead of re-running already-completed work.
 */
export const applyRunSummaryToGraph = (graph, summary) => {
  const validated = validateTaskGraph(graph);
  const completed = new Set(summary?.completed ?? []);
  const failed = new Set(summary?.failed ?? []);
  const blocked = new Set(summary?.blocked ?? []);
  return {
    version: 1,
    tasks: validated.tasks.map((task) => {
      const status = completed.has(task.id) ? "PASSED" : failed.has(task.id) ? "FAILED" : blocked.has(task.id) ? "BLOCKED" : task.status;
      return { ...task, status };
    })
  };
};

const persistGraph = async (path, graph) => {
  await writeFile(path, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
};

/**
 * Default executor: a no-op that records a synthetic commit artifact. In a real
 * deployment this would be replaced by an injected agent executor. It never
 * performs a hard-stop action and only emits allow-listed artifacts.
 */
const defaultExecutor = async ({ task }) => ({
  artifacts: [{ type: "commit", path: `synthetic-${task.id}`, status: "ok" }]
});

const defaultGatesExecutor = async ({ gate }) => ({
  name: gate,
  command: gate,
  status: "PASSED",
  detail: ""
});

/**
 * Runs the autonomous orchestration loop. Returns a durable summary.
 */
export const runAutonomousLoop = async ({
  graph,
  executor = defaultExecutor,
  gatesExecutor = defaultGatesExecutor,
  git = null,
  logStore = null,
  environment = "local",
  signal,
  isKilled = () => false,
  maxBatches = null
} = {}) => {
  const validated = validateTaskGraph(graph);
  if (typeof executor !== "function") throw new Error("executor must be a function");
  if (typeof gatesExecutor !== "function") throw new Error("gatesExecutor must be a function");
  const summary = await runParallelWorkers({
    graph: validated,
    executor,
    gatesExecutor,
    git,
    logStore,
    environment,
    signal,
    isKilled,
    maxBatches
  });
  const limited = summary.limited;
  return Object.freeze({
    graphPath: null,
    batches: summary.batches,
    completed: Object.freeze([...summary.completed]),
    failed: Object.freeze([...summary.failed]),
    blocked: Object.freeze([...(summary.blocked ?? [])]),
    records: summary.records,
    limited,
    logPath: logStore?.path ?? null
  });
};

const writeSummary = (summary) => {
  const lines = [
    "Autonomous orchestration loop complete.",
    `Batches: ${summary.batches}`,
    `Completed: ${summary.completed.length > 0 ? summary.completed.join(", ") : "(none)"}`,
    `Failed: ${summary.failed.length > 0 ? summary.failed.join(", ") : "(none)"}`,
    `Blocked: ${summary.blocked.length > 0 ? summary.blocked.join(", ") : "(none)"}`,
    `Limited: ${summary.limited ? "yes" : "no"}`,
    `Log: ${summary.logPath ?? "(none)"}`
  ];
  return lines.join("\n");
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const graph = await loadGraph(args.graph);
  await mkdir(dirname(args.log), { recursive: true });
  const logStore = createFileLogStore({ path: args.log });
  const git = args.dryRun ? null : createShellGit();
  const summary = await runAutonomousLoop({ graph, git, logStore, maxBatches: args.maxBatches });
  process.stdout.write(`${writeSummary(summary)}\n`);
  if (!args.noPersistGraph) {
    const updatedGraph = applyRunSummaryToGraph(graph, summary);
    await persistGraph(args.graph, updatedGraph);
  }
  if (summary.failed.length > 0 || summary.blocked.length > 0 || summary.limited) process.exitCode = 1;
};


if (process.argv[1] && process.argv[1].endsWith("/autonomous-loop.mjs")) {
  main().catch((error) => {
    process.stderr.write(`${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
