const RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "SECURITY_SENSITIVE"]);
const TASK_STATUSES = new Set(["PENDING", "RUNNING", "PASSED", "FAILED", "BLOCKED"]);
const SAFE_ACTIONS = new Set([
  "read",
  "edit",
  "run_test",
  "run_lint",
  "run_typecheck",
  "run_build",
  "create_branch",
  "create_commit",
  "create_handoff"
]);
const HARD_STOP_PATTERNS = [
  /production[_ -]?deploy/i,
  /deploy[_ -]?production/i,
  /production[_ -]?(secret|credential|data)/i,
  /(payment|payout)[_ -]?(destination|credential)/i,
  /destructive[_ -]?migration/i,
  /(delete|destroy)[_ -]?(customer|production)[_ -]?data/i,
  /(disable|bypass)[_ -]?(test|security)/i,
  /(change|override)[_ -]?(core[_ -]?)?(invariant|source[_ -]of[_ -]truth)/i
];

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const asStringArray = (value, field) => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) throw new Error(`${field} must be an array of non-empty strings`);
  return [...new Set(value.map((entry) => entry.trim()))];
};

const validateTask = (task) => {
  if (!task || typeof task !== "object") throw new Error("task must be an object");
  const id = asNonEmptyString(task.id, "task.id");
  const risk = asNonEmptyString(task.risk, `task ${id}.risk`).toUpperCase();
  if (!RISK_LEVELS.has(risk)) throw new Error(`task ${id}.risk is invalid`);
  const maxAttempts = task.maxAttempts ?? 1;
  const timeoutMs = task.timeoutMs ?? 300_000;
  const budgetUnits = task.budgetUnits ?? 100;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error(`task ${id}.maxAttempts must be 1..5`);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 1_800_000) throw new Error(`task ${id}.timeoutMs must be 1000..1800000`);
  if (!Number.isInteger(budgetUnits) || budgetUnits < 1 || budgetUnits > 1_000) throw new Error(`task ${id}.budgetUnits must be 1..1000`);
  return Object.freeze({
    id,
    owner: asNonEmptyString(task.owner, `task ${id}.owner`),
    dependsOn: asStringArray(task.dependsOn ?? [], `task ${id}.dependsOn`),
    scope: asStringArray(task.scope, `task ${id}.scope`),
    affectedPaths: asStringArray(task.affectedPaths, `task ${id}.affectedPaths`),
    tests: asStringArray(task.tests, `task ${id}.tests`),
    prohibitedActions: asStringArray(task.prohibitedActions ?? [], `task ${id}.prohibitedActions`),
    risk,
    maxAttempts,
    timeoutMs,
    budgetUnits,
    status: task.status === undefined ? "PENDING" : asNonEmptyString(task.status, `task ${id}.status`).toUpperCase()
  });
};

const hasPathOverlap = (left, right) => left.some((path) => right.includes(path));

export const validateTaskGraph = (graph) => {
  if (!graph || graph.version !== 1 || !Array.isArray(graph.tasks) || graph.tasks.length === 0) throw new Error("graph must have version 1 and at least one task");
  const tasks = graph.tasks.map(validateTask);
  const byId = new Map();
  for (const task of tasks) {
    if (byId.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    if (!TASK_STATUSES.has(task.status)) throw new Error(`task ${task.id}.status is invalid`);
    byId.set(task.id, task);
  }
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency)) throw new Error(`task ${task.id} depends on unknown task ${dependency}`);
      if (dependency === task.id) throw new Error(`task ${task.id} cannot depend on itself`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`task graph contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
  for (let index = 0; index < tasks.length; index += 1) {
    for (let next = index + 1; next < tasks.length; next += 1) {
      const left = tasks[index];
      const right = tasks[next];
      const ordered = left.dependsOn.includes(right.id) || right.dependsOn.includes(left.id);
      if (!ordered && hasPathOverlap(left.affectedPaths, right.affectedPaths)) throw new Error(`unsequenced affected-path overlap: ${left.id} and ${right.id}`);
    }
  }
  return Object.freeze({ version: 1, tasks: Object.freeze(tasks) });
};

export const readyTasks = (graph, completedIds = []) => {
  const validated = validateTaskGraph(graph);
  const completed = new Set(completedIds);
  return validated.tasks.filter((task) => task.status === "PENDING" && !completed.has(task.id) && task.dependsOn.every((dependency) => completed.has(dependency))).map((task) => task.id);
};

export const evaluateAction = ({ action, environment = "local", approved = false } = {}) => {
  const requested = asNonEmptyString(action, "action").toLowerCase();
  if (HARD_STOP_PATTERNS.some((pattern) => pattern.test(requested))) return { allowed: false, basis: "hard_stop", action: requested };
  if (environment.toLowerCase() === "production") return { allowed: false, basis: "production_environment_denied", action: requested };
  if (!SAFE_ACTIONS.has(requested)) return { allowed: false, basis: "default_deny", action: requested };
  return { allowed: true, basis: approved ? "approved_safe_action" : "safe_action", action: requested };
};

const sanitizeArtifacts = (artifacts = []) => {
  if (!Array.isArray(artifacts) || artifacts.length > 100) throw new Error("artifacts must be an array with at most 100 entries");
  return artifacts.map((artifact, index) => {
    if (!artifact || typeof artifact !== "object") throw new Error(`artifact ${index} must be an object`);
    const unknown = Object.keys(artifact).filter((key) => !["type", "path", "status"].includes(key));
    if (unknown.length > 0) throw new Error(`artifact ${index} contains prohibited metadata: ${unknown.join(",")}`);
    return Object.freeze({
      type: asNonEmptyString(artifact.type, `artifact ${index}.type`),
      path: asNonEmptyString(artifact.path, `artifact ${index}.path`),
      status: asNonEmptyString(artifact.status, `artifact ${index}.status`)
    });
  });
};

const result = (taskId, status, attempts, costUnits, failureClass, artifacts = []) => Object.freeze({
  taskId,
  status,
  attempts,
  costUnits,
  failureClass,
  artifacts: Object.freeze(artifacts)
});

export const runBoundedTask = async ({ task, actions, executor, environment = "local", signal, isKilled = () => false } = {}) => {
  const validated = validateTask(task);
  const requestedActions = asStringArray(actions, "actions").map((action) => action.toLowerCase());
  if (requestedActions.length === 0) throw new Error("actions must contain at least one declared action");
  if (typeof executor !== "function") throw new Error("executor must be a function");
  const prohibitedActions = new Set(validated.prohibitedActions.map((entry) => entry.toLowerCase()));
  for (const action of requestedActions) {
    if (prohibitedActions.has(action)) return result(validated.id, "BLOCKED", 0, 0, "task_prohibited_action");
    const policy = evaluateAction({ action, environment });
    if (!policy.allowed) return result(validated.id, "BLOCKED", 0, 0, policy.basis);
  }
  let attempts = 0;
  let costUnits = 0;
  while (attempts < validated.maxAttempts) {
    if (signal?.aborted) return result(validated.id, "BLOCKED", attempts, costUnits, "cancelled");
    if (isKilled()) return result(validated.id, "BLOCKED", attempts, costUnits, "kill_switch");
    if (costUnits + 1 > validated.budgetUnits) return result(validated.id, "BLOCKED", attempts, costUnits, "budget_exceeded");
    attempts += 1;
    costUnits += 1;
    const attemptController = new AbortController();
    let timer;
    let onAbort;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          attemptController.abort("timeout");
          const error = new Error("task attempt timed out");
          error.failureClass = "timeout";
          reject(error);
        }, validated.timeoutMs);
      });
      const cancellation = new Promise((_, reject) => {
        onAbort = () => {
          attemptController.abort(signal.reason);
          const error = new Error("task attempt cancelled");
          error.failureClass = "cancelled";
          reject(error);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      const execution = Promise.resolve().then(() => executor({ task: validated, actions: requestedActions, attempt: attempts, signal: attemptController.signal }));
      const executionResult = await Promise.race([execution, timeout, cancellation]);
      const artifacts = sanitizeArtifacts(executionResult?.artifacts);
      return result(validated.id, "PASSED", attempts, costUnits, null, artifacts);
    } catch (error) {
      const failureClass = error?.failureClass ?? "execution_failure";
      if (failureClass === "cancelled") return result(validated.id, "BLOCKED", attempts, costUnits, failureClass);
      if (!error?.retryable || attempts >= validated.maxAttempts) return result(validated.id, "FAILED", attempts, costUnits, failureClass);
    } finally {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
  return result(validated.id, "FAILED", attempts, costUnits, "attempts_exhausted");
};

if (process.argv[1] && process.argv[1].endsWith("/control-plane.mjs") && process.argv[2] === "action") {
  const result = evaluateAction({ action: process.argv[3], environment: process.env.PCX_AGENT_ENVIRONMENT ?? "local" });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.allowed) process.exitCode = 1;
}
