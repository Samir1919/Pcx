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
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { dirname, resolve } from "node:path";
import { createDeepSeekExecutor, createProviderExecutor, createProviderPoolExecutor } from "./ai-executor.mjs";
import { createOpenAiReviewer, createProviderPoolReviewer, createProviderReviewer } from "./ai-review.mjs";
import { createFileLogStore, createShellGit, runParallelWorkers, summarizeRuns, validateTaskGraph } from "./control-plane.mjs";





// Minimal, dependency-free `.env` loader (dotenv-compatible for the subset this
// repository uses). Existing environment variables are never overwritten, and
// quoted/unquoted `KEY=VALUE` lines plus inline `#` comments are supported.
// The autonomous loop is invoked directly (not through `npm run dev`), so it
// must load `.env` itself to see `DEEPSEEK_*` / `OPENAI_*` adapter settings.
const loadEnvFile = (path) => {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return false;
  }
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const comment = value.indexOf(" #");
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    if (key !== "" && !(key in process.env)) process.env[key] = value;
  }
  return true;
};

const DEFAULT_GRAPH = "work/autonomous-graph.json";
const DEFAULT_LOG = ".worktrees/autonomous-loop.log";
const PROVIDER_NAMES = new Set(["deepseek", "openai", "anthropic", "kimi"]);

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

export const parseArgs = (argv = []) => {
  const args = { graph: DEFAULT_GRAPH, log: DEFAULT_LOG, dryRun: false, maxBatches: null, noPersistGraph: false, realExecutor: false, approvalRequired: false, deepseekExecutor: false, openAiReview: false, executorProvider: null, reviewerProvider: null, executorPool: false, reviewerPool: false, integrationTarget: "main" };
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
    } else if (arg === "--real-executor") {
      args.realExecutor = true;
    } else if (arg === "--deepseek-executor") {
      args.deepseekExecutor = true;
    } else if (arg === "--openai-review") {
      args.openAiReview = true;
    } else if (arg === "--executor-pool") {
      args.executorPool = true;
    } else if (arg === "--reviewer-pool") {
      args.reviewerPool = true;
    } else if (arg === "--executor-provider") {
      const value = asNonEmptyString(argv[index + 1], "--executor-provider");
      if (!PROVIDER_NAMES.has(value)) throw new Error(`--executor-provider must be one of ${[...PROVIDER_NAMES].join(", ")}`);
      args.executorProvider = value;
      index += 1;
    } else if (arg === "--reviewer-provider") {
      const value = asNonEmptyString(argv[index + 1], "--reviewer-provider");
      if (!PROVIDER_NAMES.has(value)) throw new Error(`--reviewer-provider must be one of ${[...PROVIDER_NAMES].join(", ")}`);
      args.reviewerProvider = value;
      index += 1;
    } else if (arg === "--approval-required") {
      args.approvalRequired = true;
    } else if (arg === "--max-batches") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--max-batches must be a positive integer");
      args.maxBatches = value;
      index += 1;
    } else if (arg === "--integration-target") {
      const value = argv[index + 1];
      if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._/-]*$/.test(value)) throw new Error("--integration-target must be a safe branch name");
      args.integrationTarget = value;
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
 * Real (non-noop) executor factory. Unlike `defaultExecutor`, this executor
 * performs a real, verifiable side effect: it writes a task-scoped marker file
 * under `.worktrees/executor-output/` and returns a real artifact path. It is
 * the demonstration path for a vendor-neutral executor (ADR 0007): it only
 * emits allow-listed artifacts, never performs a hard-stop action, and is safe
 * to run locally or in CI. A `writeFile` may be injected for deterministic
 * testing; the default uses node:fs/promises.
 */
export const createRealExecutor = ({ writeFile: write = writeFile, mkdir: makeDir = mkdir, outputDir = ".worktrees/executor-output" } = {}) => {
  if (typeof write !== "function") throw new Error("writeFile must be a function");
  if (typeof makeDir !== "function") throw new Error("mkdir must be a function");
  const safeOutputDir = outputDir.replace(/^\.\//, "").replace(/\/$/, "");
  if (safeOutputDir.startsWith("/") || safeOutputDir.split("/").includes("..")) throw new Error("outputDir must be repository-relative without traversal");
  return async ({ task }) => {
    const slug = task.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "task";
    const path = `${safeOutputDir}/${slug}.marker`;
    await makeDir(safeOutputDir, { recursive: true });
    await write(path, `completed:${task.id}\n`, "utf8");
    return { artifacts: [{ type: "commit", path, status: "ok" }] };
  };
};


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
  maxBatches = null,
  approvalBoundary,
  reviewer,
  integrationTarget = "main"
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
    maxBatches,
    approvalBoundary,
    reviewer,
    integrationTarget
  });

  const limited = summary.limited;
  const report = summarizeRuns(summary.records);
  return Object.freeze({
    graphPath: null,
    batches: summary.batches,
    completed: Object.freeze([...summary.completed]),
    failed: Object.freeze([...summary.failed]),
    blocked: Object.freeze([...(summary.blocked ?? [])]),
    records: summary.records,
    report,
    limited,
    logPath: logStore?.path ?? null
  });
};


const writeSummary = (summary) => {
  const report = summary.report;
  const lines = [
    "Autonomous orchestration loop complete.",
    `Batches: ${summary.batches}`,
    `Completed: ${summary.completed.length > 0 ? summary.completed.join(", ") : "(none)"}`,
    `Failed: ${summary.failed.length > 0 ? summary.failed.join(", ") : "(none)"}`,
    `Blocked: ${summary.blocked.length > 0 ? summary.blocked.join(", ") : "(none)"}`,
    `Limited: ${summary.limited ? "yes" : "no"}`,
    `Log: ${summary.logPath ?? "(none)"}`
  ];
  if (report) {
    lines.push(
      "--- Run report ---",
      `Tasks: ${report.taskCount}`,
      `Passed: ${report.passed}`,
      `Failed: ${report.failed}`,
      `Blocked: ${report.blocked}`,
      `Total cost units: ${report.totalCostUnits}`,
      `Total prompt tokens: ${report.totalPromptTokens}`,
      `Total completion tokens: ${report.totalCompletionTokens}`,
      `Total runtime (ms): ${report.totalRuntimeMs}`,
      `Retry rate: ${report.retryRate.toFixed(3)}`,
      `Batches: ${report.batches.length > 0 ? report.batches.join(", ") : "(none)"}`
    );
  }
  return lines.join("\n");
};

const main = async () => {
  loadEnvFile(resolve(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));
  const graph = await loadGraph(args.graph);
  await mkdir(dirname(args.log), { recursive: true });
  const logStore = createFileLogStore({ path: args.log });
  const git = args.dryRun ? null : createShellGit();
  // Executor selection (priority): --executor-provider <name> → generic provider
  // adapter; --deepseek-executor → DeepSeek; --real-executor → local marker-file
  // executor. The generic provider reads its `<PREFIX>_*` env config and fails
  // fast when the provider is held or missing a key. Otherwise the no-op
  // executor (undefined) is used.
  const executor = args.executorProvider
    ? createProviderExecutor({ name: args.executorProvider })
    : args.executorPool
      ? createProviderPoolExecutor()
      : args.deepseekExecutor
        ? createDeepSeekExecutor()
        : args.realExecutor
          ? createRealExecutor()
          : undefined;
  // Reviewer selection (priority): --reviewer-provider <name> → generic provider
  // adapter; --reviewer-pool → provider pool; --openai-review → OpenAI.
  // Otherwise the deterministic local review adapter is used.
  const reviewer = args.reviewerProvider
    ? createProviderReviewer({ name: args.reviewerProvider })
    : args.reviewerPool
      ? createProviderPoolReviewer()
      : args.openAiReview
        ? createOpenAiReviewer()
        : undefined;
  const approvalBoundary = args.approvalRequired ? { requiresApproval: ["create_commit"], approved: [] } : undefined;
  const summary = await runAutonomousLoop({ graph, git, logStore, maxBatches: args.maxBatches, executor, reviewer, approvalBoundary, integrationTarget: args.integrationTarget });
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
