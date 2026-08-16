import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAction, readyTasks, runBoundedTask, validateTaskGraph } from "./control-plane.mjs";

const task = (id, overrides = {}) => ({
  id,
  owner: "worker-1",
  scope: [`scope:${id}`],
  affectedPaths: [`apps/${id}.mjs`],
  tests: [`test:${id}`],
  risk: "LOW",
  ...overrides
});

test("validates a bounded DAG and returns dependency-ready work", () => {
  const graph = validateTaskGraph({ version: 1, tasks: [task("spec"), task("worker", { dependsOn: ["spec"] }), task("qa", { dependsOn: ["worker"] })] });
  assert.deepEqual(readyTasks(graph), ["spec"]);
  assert.deepEqual(readyTasks(graph, ["spec"]), ["worker"]);
});

test("rejects unknown dependencies, cycles, and unsequenced path overlap", () => {
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("a", { dependsOn: ["missing"] })] }), /unknown task/);
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("a", { dependsOn: ["b"] }), task("b", { dependsOn: ["a"] })] }), /cycle/);
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("a", { affectedPaths: ["shared/file"] }), task("b", { affectedPaths: ["shared/file"] })] }), /overlap/);
});

test("enforces bounded retry, timeout, and budget values", () => {
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("bad", { maxAttempts: 6 })] }), /maxAttempts/);
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("bad", { timeoutMs: 999 })] }), /timeoutMs/);
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("bad", { budgetUnits: 0 })] }), /budgetUnits/);
});

test("defaults policy to deny and preserves hard stops", () => {
  assert.deepEqual(evaluateAction({ action: "run_test" }), { allowed: true, basis: "safe_action", action: "run_test" });
  assert.equal(evaluateAction({ action: "merge" }).allowed, false);
  assert.equal(evaluateAction({ action: "production_deploy" }).basis, "hard_stop");
  assert.equal(evaluateAction({ action: "edit", environment: "production" }).basis, "production_environment_denied");
});

test("bounded runner blocks denied actions before executor invocation", async () => {
  let calls = 0;
  const outcome = await runBoundedTask({ task: task("blocked"), actions: ["production_deploy"], executor: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.deepEqual(outcome, { taskId: "blocked", status: "BLOCKED", attempts: 0, costUnits: 0, failureClass: "hard_stop", artifacts: [] });
});

test("bounded runner retries within attempts and budget and sanitizes artifacts", async () => {
  const outcome = await runBoundedTask({
    task: task("retry", { maxAttempts: 2, budgetUnits: 2 }),
    actions: ["edit", "run_test"],
    executor: async ({ attempt }) => {
      if (attempt === 1) {
        const error = new Error("retry");
        error.retryable = true;
        error.failureClass = "deterministic_failure";
        throw error;
      }
      return { artifacts: [{ type: "test", path: "outputs/test.json", status: "passed" }] };
    }
  });
  assert.equal(outcome.status, "PASSED");
  assert.equal(outcome.attempts, 2);
  assert.equal(outcome.costUnits, 2);
  assert.deepEqual(outcome.artifacts, [{ type: "test", path: "outputs/test.json", status: "passed" }]);
});

test("bounded runner enforces budget, cancellation, kill switch, and artifact allow-list", async () => {
  const retrying = async () => {
    const error = new Error("retry");
    error.retryable = true;
    throw error;
  };
  const budget = await runBoundedTask({ task: task("budget", { maxAttempts: 2, budgetUnits: 1 }), actions: ["read"], executor: retrying });
  assert.equal(budget.failureClass, "budget_exceeded");
  const controller = new AbortController();
  controller.abort();
  assert.equal((await runBoundedTask({ task: task("cancel"), actions: ["read"], executor: async () => { }, signal: controller.signal })).failureClass, "cancelled");
  assert.equal((await runBoundedTask({ task: task("kill"), actions: ["read"], executor: async () => { }, isKilled: () => true })).failureClass, "kill_switch");
  const unsafeArtifact = await runBoundedTask({ task: task("artifact"), actions: ["read"], executor: async () => ({ artifacts: [{ type: "log", path: "x", status: "ok", token: "secret" }] }) });
  assert.equal(unsafeArtifact.status, "FAILED");
});

test("bounded runner times out an unresponsive executor", async () => {
  const outcome = await runBoundedTask({ task: task("timeout", { timeoutMs: 1_000 }), actions: ["read"], executor: async () => new Promise(() => { }) });
  assert.equal(outcome.failureClass, "timeout");
  assert.equal(outcome.attempts, 1);
});
