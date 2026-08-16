import assert from "node:assert/strict";
import test from "node:test";
import { createFileLogStore } from "./control-plane.mjs";
import { applyRunSummaryToGraph, runAutonomousLoop } from "./autonomous-loop.mjs";


const task = (id, overrides = {}) => ({
  id,
  owner: "worker-1",
  scope: [`scope:${id}`],
  affectedPaths: [`apps/${id}.mjs`],
  tests: [`test:${id}`],
  risk: "LOW",
  ...overrides
});

const passingExecutor = async ({ task: t }) => ({ artifacts: [{ type: "commit", path: `abc-${t.id}`, status: "ok" }] });
const passingGates = async ({ gate }) => ({ name: gate, command: gate, status: "PASSED", detail: "" });

test("autonomous loop runs a dependency-ready graph to completion", async () => {
  const graph = {
    version: 1,
    tasks: [
      task("spec", { affectedPaths: ["docs/spec.md"] }),
      task("api", { affectedPaths: ["apps/api/src/a.mjs"], dependsOn: ["spec"] }),
      task("web", { affectedPaths: ["apps/web/src/b.mjs"], dependsOn: ["spec"] })
    ]
  };
  const summary = await runAutonomousLoop({ graph, executor: passingExecutor, gatesExecutor: passingGates });
  assert.deepEqual([...summary.completed].sort(), ["api", "spec", "web"]);
  assert.deepEqual(summary.failed, []);
  assert.equal(summary.batches, 2);
  assert.equal(summary.records.length, 3);
  assert.ok(summary.records.every((record) => record.status === "PASSED"));
});

test("autonomous loop records failed tasks and terminates", async () => {
  const graph = {
    version: 1,
    tasks: [
      task("good", { affectedPaths: ["apps/api/src/good.mjs"] }),
      task("bad", { affectedPaths: ["apps/api/src/bad.mjs"] })
    ]
  };
  const executor = async ({ task: t }) => {
    if (t.id === "bad") {
      const error = new Error("boom");
      error.retryable = true;
      throw error;
    }
    return { artifacts: [{ type: "commit", path: "abc", status: "ok" }] };
  };
  const summary = await runAutonomousLoop({ graph, executor, gatesExecutor: passingGates });
  assert.deepEqual([...summary.completed], ["good"]);
  assert.deepEqual([...summary.failed], ["bad"]);
  assert.equal(summary.records.length, 2);
});

test("autonomous loop persists runs to a durable log store", async () => {
  const graph = {
    version: 1,
    tasks: [task("spec", { affectedPaths: ["docs/spec.md"] }), task("api", { affectedPaths: ["apps/api/src/a.mjs"], dependsOn: ["spec"] })]
  };
  const lines = [];
  const logStore = createFileLogStore({ path: ".worktrees/autonomous-loop.log", write: async ({ line }) => { lines.push(line); }, read: async () => lines.map((entry) => JSON.parse(entry)) });
  const summary = await runAutonomousLoop({ graph, executor: passingExecutor, gatesExecutor: passingGates, logStore });
  assert.deepEqual([...summary.completed].sort(), ["api", "spec"]);
  assert.equal(summary.logPath, ".worktrees/autonomous-loop.log");
  assert.equal(lines.length, 2);
  const entries = lines.map((line) => JSON.parse(line));
  assert.deepEqual(entries.map((entry) => entry.taskId).sort(), ["api", "spec"]);
  assert.ok(entries.every((entry) => entry.status === "PASSED"));
});

test("autonomous loop creates, merges, and removes worktrees when git is provided", async () => {
  const graph = {
    version: 1,
    tasks: [task("api", { affectedPaths: ["apps/api/src/a.mjs"] })]
  };
  const calls = [];
  const git = {
    addWorktree: async ({ branch, path }) => { calls.push(["add", branch, path]); return { ok: true }; },
    removeWorktree: async ({ path }) => { calls.push(["remove", path]); return { ok: true }; },
    mergeBranch: async ({ branch, into }) => { calls.push(["merge", branch, into]); return { ok: true, conflicts: [] }; }
  };
  const summary = await runAutonomousLoop({ graph, executor: passingExecutor, gatesExecutor: passingGates, git });
  assert.deepEqual([...summary.completed], ["api"]);
  assert.deepEqual(calls, [
    ["add", "agent/api", ".worktrees/api"],
    ["merge", "agent/api", "integration"],
    ["remove", ".worktrees/api"]
  ]);
});

test("autonomous loop defers conflicting tasks and runs them sequentially", async () => {
  const graph = {
    version: 1,
    tasks: [
      task("api-a", { affectedPaths: ["apps/api/src/a.mjs"] }),
      task("api-b", { affectedPaths: ["apps/api/src/b.mjs"] })
    ]
  };
  const summary = await runAutonomousLoop({ graph, executor: passingExecutor, gatesExecutor: passingGates });
  assert.deepEqual([...summary.completed].sort(), ["api-a", "api-b"]);
  assert.equal(summary.records.length, 2);
  assert.ok(summary.records.every((record) => record.status === "PASSED"));
});

test("autonomous loop rejects an invalid graph", async () => {
  await assert.rejects(() => runAutonomousLoop({ graph: { version: 1, tasks: [task("a", { dependsOn: ["missing"] })] } }), /unknown task/);
  await assert.rejects(() => runAutonomousLoop({ graph: { version: 1, tasks: [] } }), /at least one/);
});

test("autonomous loop requires executor and gatesExecutor functions", async () => {
  const graph = { version: 1, tasks: [task("a")] };
  await assert.rejects(() => runAutonomousLoop({ graph, executor: "not-a-function", gatesExecutor: passingGates }), /executor must be a function/);
  await assert.rejects(() => runAutonomousLoop({ graph, executor: passingExecutor, gatesExecutor: null }), /gatesExecutor must be a function/);
});

test("applyRunSummaryToGraph marks completed, failed, and blocked tasks durably", () => {
  const graph = {
    version: 1,
    tasks: [
      task("spec", { affectedPaths: ["docs/spec.md"] }),
      task("api", { affectedPaths: ["apps/api/src/a.mjs"], dependsOn: ["spec"] }),
      task("bad", { affectedPaths: ["apps/api/src/bad.mjs"] })
    ]
  };
  const summary = { completed: ["spec", "api"], failed: ["bad"], blocked: [] };
  const updated = applyRunSummaryToGraph(graph, summary);
  const byId = Object.fromEntries(updated.tasks.map((t) => [t.id, t.status]));
  assert.equal(byId.spec, "PASSED");
  assert.equal(byId.api, "PASSED");
  assert.equal(byId.bad, "FAILED");
});

test("applyRunSummaryToGraph preserves the status of tasks not touched by the run", () => {
  const graph = { version: 1, tasks: [task("spec"), task("api", { dependsOn: ["spec"] })] };
  const updated = applyRunSummaryToGraph(graph, { completed: ["spec"], failed: [], blocked: [] });
  const byId = Object.fromEntries(updated.tasks.map((t) => [t.id, t.status]));
  assert.equal(byId.spec, "PASSED");
  assert.equal(byId.api, "PENDING");
});

test("autonomous loop exposes and persists blocked dependents without falsely reporting a batch limit", async () => {
  const graph = { version: 1, tasks: [task("bad"), task("dependent", { dependsOn: ["bad"] })] };
  const executor = async () => { throw new Error("boom"); };
  const summary = await runAutonomousLoop({ graph, executor, gatesExecutor: passingGates, maxBatches: 1 });
  assert.deepEqual(summary.failed, ["bad"]);
  assert.deepEqual(summary.blocked, ["dependent"]);
  assert.equal(summary.limited, false);
  const updated = applyRunSummaryToGraph(graph, summary);
  assert.equal(updated.tasks.find((entry) => entry.id === "dependent").status, "BLOCKED");
});
