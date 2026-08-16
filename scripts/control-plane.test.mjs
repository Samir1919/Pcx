import assert from "node:assert/strict";
import test from "node:test";
import { appendRunRecord, buildHandoff, createFileLogStore, createShellGit, createWorktree, evaluateAction, mergeWorktree, planParallelTasks, readyTasks, removeWorktree, reviewTask, runBoundedTask, runParallelWorkers, runQaGates, securityReview, validateTaskGraph, verifyIntegrated } from "./control-plane.mjs";

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

test("path validation is prefix-aware, traversal-safe, and permits transitive ordering", () => {
  const shared = "apps/api/src/shared.mjs";
  assert.doesNotThrow(() => validateTaskGraph({ version: 1, tasks: [task("a", { affectedPaths: [shared] }), task("b", { affectedPaths: [shared], dependsOn: ["a"] }), task("c", { affectedPaths: [shared], dependsOn: ["b"] })] }));
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("a", { affectedPaths: ["apps/api"] }), task("b", { affectedPaths: ["apps/api/src/file.mjs"] })] }), /overlap/);
  assert.throws(() => validateTaskGraph({ version: 1, tasks: [task("escape", { affectedPaths: ["../outside"] })] }), /repository-relative/);
});

test("parallel planner selects isolated modules and defers module and migration writers", () => {
  const modules = planParallelTasks({
    version: 1, tasks: [
      task("API Feature", { affectedPaths: ["apps/api/src/a.mjs"] }),
      task("api-second", { affectedPaths: ["apps/api/src/b.mjs"] }),
      task("web", { affectedPaths: ["apps/web/src/c.mjs"] })
    ]
  });
  assert.deepEqual(modules.selected, [
    { taskId: "API Feature", branch: "agent/api-feature", worktree: ".worktrees/api-feature" },
    { taskId: "web", branch: "agent/web", worktree: ".worktrees/web" }
  ]);
  assert.deepEqual(modules.deferred[0], { taskId: "api-second", conflicts: [{ taskId: "API Feature", reasons: ["module_overlap"] }] });
  const migrations = planParallelTasks({
    version: 1, tasks: [
      task("api-migration", { affectedPaths: ["apps/api/migrations/100.sql"] }),
      task("domain-migration", { affectedPaths: ["packages/domain/migrations/200.sql"] })
    ]
  });
  assert.deepEqual(migrations.selected.map((entry) => entry.taskId), ["api-migration"]);
  assert.deepEqual(migrations.deferred[0].conflicts[0].reasons, ["migration_writer_overlap"]);
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

test("review adapter approves clean work and rejects blocker/major findings", () => {
  const clean = reviewTask({ task: task("clean"), checks: ["invariants", "authz"], findings: [{ severity: "NIT", code: "style", message: "minor" }] });
  assert.equal(clean.verdict, "APPROVED");
  assert.equal(clean.blocked, false);
  assert.deepEqual(clean.severityCounts, { BLOCKER: 0, MAJOR: 0, MINOR: 0, NIT: 1 });
  const blocked = reviewTask({ task: task("blocked"), findings: [{ severity: "MAJOR", code: "invariant", message: "violates core invariant" }] });
  assert.equal(blocked.verdict, "REJECTED");
  assert.equal(blocked.blocked, true);
  assert.throws(() => reviewTask({ task: task("bad"), findings: [{ severity: "CRITICAL", code: "x", message: "y" }] }), /severity/);
});

test("QA adapter runs declared gates and never reports a failing gate as passing", async () => {
  const outcome = await runQaGates({
    task: task("qa"),
    gates: ["npm run verify:e0", "npm test"],
    executor: async ({ gate }) => ({ name: gate, command: gate, status: gate.includes("verify") ? "PASSED" : "FAILED", detail: "" })
  });
  assert.equal(outcome.verdict, "FAILED");
  assert.equal(outcome.passed, 1);
  assert.equal(outcome.failed, 1);
  assert.equal(outcome.notRun, 0);
  await assert.rejects(() => runQaGates({ task: task("qa"), gates: [], executor: async () => ({}) }), /at least one/);
});

test("security adapter is mandatory for sensitive surfaces and cannot approve production policy", () => {
  const sensitive = securityReview({ task: task("auth", { scope: ["auth"], affectedPaths: ["apps/api/src/auth.mjs"] }), findings: [] });
  assert.equal(sensitive.required, true);
  assert.equal(sensitive.verdict, "APPROVED");
  const blocked = securityReview({ task: task("auth", { scope: ["auth"] }), findings: [{ severity: "BLOCKER", code: "pii", message: "exposes PII" }] });
  assert.equal(blocked.verdict, "REJECTED");
  const unrelated = securityReview({ task: task("catalog", { scope: ["catalog"] }) });
  assert.equal(unrelated.required, false);
  assert.equal(unrelated.verdict, "NOT_REQUIRED");
});

test("integrated verification requires all gates to pass before readiness", () => {
  const qa = { taskId: "ready", verdict: "PASSED" };
  const review = { verdict: "APPROVED" };
  const security = { verdict: "NOT_REQUIRED" };
  assert.equal(verifyIntegrated({ task: task("ready"), qa, review, security }).verdict, "READY");
  assert.equal(verifyIntegrated({ task: task("ready"), qa: { taskId: "ready", verdict: "INCOMPLETE" }, review, security }).verdict, "NOT_READY");
  assert.throws(() => verifyIntegrated({ task: task("ready"), qa: { taskId: "other", verdict: "PASSED" } }), /taskId mismatch/);
});

test("handoff adapter produces a durable, secret-free completion record", () => {
  const record = buildHandoff({
    task: task("handoff"),
    branch: "agent/handoff",
    commit: "abc123",
    qa: { verdict: "PASSED" },
    security: { verdict: "NOT_REQUIRED" },
    review: { verdict: "APPROVED" },
    sections: { outcome: "done", blockers: "none" }
  });

  assert.equal(record.status, "Complete");
  assert.equal(record.qaVerdict, "PASSED");
  assert.equal(record.securityVerdict, "NOT_REQUIRED");
  assert.equal(record.reviewVerdict, "APPROVED");
  assert.deepEqual(record.sections, { outcome: "done", blockers: "none" });
  assert.throws(() => buildHandoff({ task: task("handoff"), branch: "b", commit: "c", sections: { secret: "leak" } }), /prohibited section/);
  assert.throws(() => buildHandoff({ task: task("handoff"), branch: "b", commit: "c", sections: { outcome: "" } }), /non-empty/);
});

test("worktree plan validation requires agent branches and .worktrees paths", async () => {
  const git = { addWorktree: async () => ({ ok: true }) };
  const created = await createWorktree({ plan: { taskId: "a", branch: "agent/a", worktree: ".worktrees/a" }, git });
  assert.equal(created.created, true);
  assert.equal(created.worktree, ".worktrees/a");
  await assert.rejects(() => createWorktree({ plan: { taskId: "a", branch: "main", worktree: ".worktrees/a" }, git }), /agent branch/);
  await assert.rejects(() => createWorktree({ plan: { taskId: "a", branch: "agent/a", worktree: "apps/a" }, git }), /\.worktrees/);
  await assert.rejects(() => createWorktree({ plan: { taskId: "a", branch: "agent/a", worktree: "../escape" }, git }), /repository-relative/);
  await assert.rejects(() => createWorktree({ plan: { taskId: "a", branch: "agent/a", worktree: ".worktrees/a" } }), /git\.addWorktree/);
});

test("worktree create/remove/merge orchestration delegates to injected git", async () => {
  const calls = [];
  const git = {
    addWorktree: async ({ branch, path }) => { calls.push(["add", branch, path]); return { ok: true }; },
    removeWorktree: async ({ path }) => { calls.push(["remove", path]); return { ok: true }; },
    mergeBranch: async ({ branch, into }) => { calls.push(["merge", branch, into]); return { ok: true, conflicts: [] }; }
  };
  const plan = { taskId: "a", branch: "agent/a", worktree: ".worktrees/a" };
  assert.equal((await createWorktree({ plan, git })).created, true);
  assert.equal((await removeWorktree({ plan, git })).removed, true);
  const merged = await mergeWorktree({ plan, git, into: "integration" });
  assert.equal(merged.merged, true);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(calls, [
    ["add", "agent/a", ".worktrees/a"],
    ["remove", ".worktrees/a"],
    ["merge", "agent/a", "integration"]
  ]);
});

test("merge orchestration reports conflicts deterministically", async () => {
  const git = { mergeBranch: async () => ({ ok: false, conflicts: ["apps/api/src/a.mjs"] }) };
  const merged = await mergeWorktree({ plan: { taskId: "a", branch: "agent/a", worktree: ".worktrees/a" }, git });
  assert.equal(merged.merged, false);
  assert.deepEqual(merged.conflicts, ["apps/api/src/a.mjs"]);
});

test("parallel worker driver runs dependency-ready tasks and produces handoffs", async () => {
  const graph = {
    version: 1,
    tasks: [
      task("spec", { affectedPaths: ["docs/spec.md"] }),
      task("api", { affectedPaths: ["apps/api/src/a.mjs"], dependsOn: ["spec"] }),
      task("web", { affectedPaths: ["apps/web/src/b.mjs"], dependsOn: ["spec"] })
    ]
  };
  const executor = async ({ task: t }) => ({ artifacts: [{ type: "commit", path: "abc123", status: "ok" }] });
  const gatesExecutor = async ({ gate }) => ({ name: gate, command: gate, status: "PASSED", detail: "" });
  const summary = await runParallelWorkers({ graph, executor, gatesExecutor });
  assert.deepEqual([...summary.completed].sort(), ["api", "spec", "web"]);
  assert.deepEqual(summary.failed, []);
  assert.equal(summary.records.length, 3);
  assert.ok(summary.records.every((record) => record.status === "PASSED"));
  assert.ok(summary.records.every((record) => record.handoff && record.handoff.status === "Complete"));
});

test("parallel worker driver defers conflicting tasks and runs them sequentially", async () => {
  const graph = {
    version: 1,
    tasks: [
      task("api-a", { affectedPaths: ["apps/api/src/a.mjs"] }),
      task("api-b", { affectedPaths: ["apps/api/src/b.mjs"] })
    ]
  };
  const executor = async ({ task: t }) => ({ artifacts: [{ type: "commit", path: "abc", status: "ok" }] });
  const gatesExecutor = async ({ gate }) => ({ name: gate, command: gate, status: "PASSED", detail: "" });
  const summary = await runParallelWorkers({ graph, executor, gatesExecutor });
  assert.deepEqual([...summary.completed].sort(), ["api-a", "api-b"]);
  assert.equal(summary.records.length, 2);
  assert.ok(summary.records.every((record) => record.status === "PASSED"));
});

test("parallel worker driver records failed tasks and does not loop forever", async () => {
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
  const gatesExecutor = async ({ gate }) => ({ name: gate, command: gate, status: "PASSED", detail: "" });
  const summary = await runParallelWorkers({ graph, executor, gatesExecutor });
  assert.deepEqual([...summary.completed], ["good"]);
  assert.deepEqual([...summary.failed], ["bad"]);
  assert.equal(summary.records.length, 2);
  const bad = summary.records.find((record) => record.taskId === "bad");
  assert.equal(bad.status, "FAILED");
  assert.equal(bad.failureClass, "execution_failure");
});

test("parallel worker driver creates, merges, and removes worktrees when git is provided", async () => {
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
  const executor = async ({ task: t }) => ({ artifacts: [{ type: "commit", path: "abc", status: "ok" }] });
  const gatesExecutor = async ({ gate }) => ({ name: gate, command: gate, status: "PASSED", detail: "" });
  const summary = await runParallelWorkers({ graph, executor, gatesExecutor, git });
  assert.deepEqual([...summary.completed], ["api"]);
  assert.deepEqual(calls, [
    ["add", "agent/api", ".worktrees/api"],
    ["merge", "agent/api", "integration"],
    ["remove", ".worktrees/api"]
  ]);
});

test("shell git adapter validates inputs and delegates to injected run", async () => {
  const calls = [];
  const run = async ({ args, cwd, into }) => {
    calls.push({ args, cwd, into });
    return { ok: true, conflicts: [] };
  };
  const git = createShellGit({ run, cwd: "/repo" });
  assert.equal((await git.addWorktree({ branch: "agent/a", path: ".worktrees/a" })).ok, true);
  assert.equal((await git.removeWorktree({ path: ".worktrees/a" })).ok, true);
  assert.equal((await git.mergeBranch({ branch: "agent/a", into: "integration" })).ok, true);
  assert.deepEqual(calls[0].args, ["worktree", "add", ".worktrees/a", "-b", "agent/a"]);
  assert.deepEqual(calls[1].args, ["worktree", "remove", ".worktrees/a"]);
  assert.deepEqual(calls[2].args, ["merge", "--no-ff", "agent/a"]);
  assert.equal(calls[2].into, "integration");
  assert.equal(calls[0].cwd, "/repo");
  await assert.rejects(() => git.addWorktree({ branch: "main", path: ".worktrees/a" }), /agent branch/);
  await assert.rejects(() => git.addWorktree({ branch: "agent/a", path: "apps/a" }), /\.worktrees/);
  await assert.rejects(() => git.mergeBranch({ branch: "agent/a", into: "bad branch!" }), /safe branch/);
});

test("shell git adapter reports merge conflicts from injected run", async () => {
  const git = createShellGit({ run: async () => ({ ok: false, conflicts: ["apps/api/src/a.mjs"], error: "conflict" }) });
  const merged = await git.mergeBranch({ branch: "agent/a", into: "integration" });
  assert.equal(merged.ok, false);
  assert.deepEqual(merged.conflicts, ["apps/api/src/a.mjs"]);
  assert.equal(merged.error, "conflict");
});

test("file log store sanitizes records and rejects secrets", async () => {
  const lines = [];
  const store = createFileLogStore({ path: ".worktrees/control-plane.log", write: async ({ line }) => { lines.push(line); }, read: async () => lines.map((line) => JSON.parse(line)) });
  const clean = await store.append({ ts: "2026-01-01T00:00:00.000Z", taskId: "a", status: "PASSED", attempts: 1, costUnits: 1, qaVerdict: "PASSED", batch: 0 });
  assert.equal(clean.taskId, "a");
  assert.equal(clean.status, "PASSED");
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.taskId, "a");
  assert.equal(parsed.status, "PASSED");
  await assert.rejects(() => store.append({ taskId: "a", status: "PASSED", token: "secret" }), /prohibited field/);
  await assert.rejects(() => store.append({ taskId: "a", status: "PASSED", commit: "abc-secret" }), /secret/);

  const all = await store.readAll();
  assert.equal(all.length, 1);
  assert.equal(all[0].taskId, "a");
});

test("file log store requires a .worktrees path", () => {
  assert.throws(() => createFileLogStore({ path: "logs/control-plane.log" }), /\.worktrees/);
  assert.throws(() => createFileLogStore({ path: "../escape.log" }), /repository-relative/);
});

test("appendRunRecord maps a worker record to a sanitized durable entry", async () => {
  const lines = [];
  const store = createFileLogStore({ path: ".worktrees/control-plane.log", write: async ({ line }) => { lines.push(line); }, read: async () => lines.map((line) => JSON.parse(line)) });
  const record = {
    taskId: "a",
    status: "PASSED",
    failureClass: null,
    execution: { attempts: 2, costUnits: 2 },
    qa: { verdict: "PASSED" },
    security: { verdict: "NOT_REQUIRED" },
    review: { verdict: "APPROVED" },
    handoff: { commit: "abc123" }
  };
  const entry = await appendRunRecord({ store, record, batch: 3 });
  assert.equal(entry.taskId, "a");
  assert.equal(entry.status, "PASSED");
  assert.equal(entry.attempts, 2);
  assert.equal(entry.costUnits, 2);
  assert.equal(entry.qaVerdict, "PASSED");
  assert.equal(entry.securityVerdict, "NOT_REQUIRED");
  assert.equal(entry.reviewVerdict, "APPROVED");
  assert.equal(entry.commit, "abc123");
  assert.equal(entry.batch, 3);
  assert.equal(await appendRunRecord({ record }), null);
});
