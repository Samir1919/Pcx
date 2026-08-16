import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAction, readyTasks, validateTaskGraph } from "./control-plane.mjs";

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
