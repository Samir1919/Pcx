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

const normalizeRepositoryPath = (value, field) => {
  const path = asNonEmptyString(value, field).replaceAll("\\", "/").replace(/^\.\//, "");
  if (path.startsWith("/") || path.split("/").includes("..")) throw new Error(`${field} must be repository-relative without traversal`);
  return path.replace(/\/$/, "");
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
    affectedPaths: asStringArray(task.affectedPaths, `task ${id}.affectedPaths`).map((path, index) => normalizeRepositoryPath(path, `task ${id}.affectedPaths[${index}]`)),
    tests: asStringArray(task.tests, `task ${id}.tests`),
    prohibitedActions: asStringArray(task.prohibitedActions ?? [], `task ${id}.prohibitedActions`),
    risk,
    maxAttempts,
    timeoutMs,
    budgetUnits,
    status: task.status === undefined ? "PENDING" : asNonEmptyString(task.status, `task ${id}.status`).toUpperCase()
  });
};

const pathsOverlap = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
const hasPathOverlap = (left, right) => left.some((leftPath) => right.some((rightPath) => pathsOverlap(leftPath, rightPath)));
const moduleForPath = (path) => {
  const parts = path.split("/");
  if (["apps", "packages"].includes(parts[0]) && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0];
};
const isMigrationPath = (path) => path === "migrations" || path.includes("/migrations/") || path.endsWith("/migrations");
const dependsOnTransitively = (taskId, dependencyId, byId, seen = new Set()) => {
  if (seen.has(taskId)) return false;
  seen.add(taskId);
  const task = byId.get(taskId);
  return task.dependsOn.includes(dependencyId) || task.dependsOn.some((id) => dependsOnTransitively(id, dependencyId, byId, new Set(seen)));
};

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
      const ordered = dependsOnTransitively(left.id, right.id, byId) || dependsOnTransitively(right.id, left.id, byId);
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

const conflictReasons = (left, right) => {
  const reasons = [];
  if (hasPathOverlap(left.affectedPaths, right.affectedPaths)) reasons.push("path_overlap");
  const leftModules = new Set(left.affectedPaths.map(moduleForPath));
  if (right.affectedPaths.some((path) => leftModules.has(moduleForPath(path)))) reasons.push("module_overlap");
  if (left.affectedPaths.some(isMigrationPath) && right.affectedPaths.some(isMigrationPath)) reasons.push("migration_writer_overlap");
  return [...new Set(reasons)];
};

const slugTaskId = (id) => {
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error(`task id cannot produce a safe branch slug: ${id}`);
  return slug.slice(0, 80);
};

export const planParallelTasks = (graph, completedIds = []) => {
  const validated = validateTaskGraph(graph);
  const ready = new Set(readyTasks(validated, completedIds));
  const candidates = validated.tasks.filter((task) => ready.has(task.id));
  const selected = [];
  const deferred = [];
  for (const task of candidates) {
    const conflicts = selected.map((entry) => ({ taskId: entry.task.id, reasons: conflictReasons(task, entry.task) })).filter((entry) => entry.reasons.length > 0);
    if (conflicts.length > 0) {
      deferred.push(Object.freeze({ taskId: task.id, conflicts: Object.freeze(conflicts) }));
      continue;
    }
    const slug = slugTaskId(task.id);
    selected.push({ task, plan: Object.freeze({ taskId: task.id, branch: `agent/${slug}`, worktree: `.worktrees/${slug}` }) });
  }
  return Object.freeze({ selected: Object.freeze(selected.map((entry) => entry.plan)), deferred: Object.freeze(deferred) });
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
      path: normalizeRepositoryPath(artifact.path, `artifact ${index}.path`),
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

const FINDING_SEVERITIES = new Set(["BLOCKER", "MAJOR", "MINOR", "NIT"]);
const GATE_STATUSES = new Set(["PASSED", "FAILED", "SKIPPED", "NOT_RUN"]);
const SECURITY_SENSITIVE_SURFACES = [
  /auth/i,
  /rbac/i,
  /role/i,
  /permission/i,
  /pii/i,
  /upload/i,
  /evidence/i,
  /payment/i,
  /refund/i,
  /passport/i,
  /privileged/i,
  /secret/i,
  /credential/i,
  /callback/i,
  /webhook/i
];

const asFinding = (finding) => {
  if (!finding || typeof finding !== "object") throw new Error("finding must be an object");
  const severity = asNonEmptyString(finding.severity, "finding.severity").toUpperCase();
  if (!FINDING_SEVERITIES.has(severity)) throw new Error(`finding.severity is invalid: ${severity}`);
  return Object.freeze({
    severity,
    code: asNonEmptyString(finding.code, "finding.code"),
    message: asNonEmptyString(finding.message, "finding.message")
  });
};

const asFindings = (findings = []) => {
  if (!Array.isArray(findings) || findings.length > 100) throw new Error("findings must be an array with at most 100 entries");
  return findings.map(asFinding);
};

const asGateResult = (gate) => {
  if (!gate || typeof gate !== "object") throw new Error("gate result must be an object");
  const status = asNonEmptyString(gate.status, "gate.status").toUpperCase();
  if (!GATE_STATUSES.has(status)) throw new Error(`gate.status is invalid: ${status}`);
  return Object.freeze({
    name: asNonEmptyString(gate.name, "gate.name"),
    command: asNonEmptyString(gate.command, "gate.command"),
    status,
    detail: typeof gate.detail === "string" ? gate.detail.trim() : ""
  });
};

const isSecuritySensitive = (task) => {
  const haystack = [task.id, task.owner, ...task.scope, ...task.affectedPaths, ...task.tests].join(" ").toLowerCase();
  return SECURITY_SENSITIVE_SURFACES.some((pattern) => pattern.test(haystack));
};

/**
 * Review adapter: evaluates an integrated task result against requirement coverage,
 * invariants, authorization/ownership, concurrency, idempotency, sensitive-data
 * exposure, compatibility, and unnecessary complexity. Returns typed findings.
 * BLOCKER/MAJOR findings must be resolved or explicitly waived by an authorized human.
 */
export const reviewTask = ({ task, checks = [], findings = [] } = {}) => {
  const validated = validateTask(task);
  const declaredChecks = asStringArray(checks, "checks");
  const reviewFindings = asFindings(findings);
  const severityCounts = { BLOCKER: 0, MAJOR: 0, MINOR: 0, NIT: 0 };
  for (const finding of reviewFindings) severityCounts[finding.severity] += 1;
  const blocked = severityCounts.BLOCKER > 0 || severityCounts.MAJOR > 0;
  return Object.freeze({
    taskId: validated.id,
    checks: Object.freeze(declaredChecks),
    findings: Object.freeze(reviewFindings),
    severityCounts: Object.freeze(severityCounts),
    blocked,
    verdict: blocked ? "REJECTED" : "APPROVED"
  });
};

/**
 * QA adapter: runs declared gates through an injected executor and records
 * commands/results. A failing or unrun gate is never reported as passing.
 */
export const runQaGates = async ({ task, gates = [], executor } = {}) => {
  const validated = validateTask(task);
  const declaredGates = asStringArray(gates, "gates");
  if (declaredGates.length === 0) throw new Error("gates must contain at least one declared gate");
  if (typeof executor !== "function") throw new Error("executor must be a function");
  const results = [];
  for (const gate of declaredGates) {
    const outcome = await executor({ task: validated, gate });
    const gateResult = asGateResult(outcome);
    results.push(gateResult);
  }
  const failed = results.some((gate) => gate.status === "FAILED");
  const notRun = results.some((gate) => gate.status === "NOT_RUN" || gate.status === "SKIPPED");
  return Object.freeze({
    taskId: validated.id,
    gates: Object.freeze(results),
    passed: results.filter((gate) => gate.status === "PASSED").length,
    failed: results.filter((gate) => gate.status === "FAILED").length,
    notRun: results.filter((gate) => gate.status === "NOT_RUN" || gate.status === "SKIPPED").length,
    verdict: failed ? "FAILED" : notRun ? "INCOMPLETE" : "PASSED"
  });
};

/**
 * Security adapter: mandatory for security-sensitive tasks. Reviews threat
 * boundaries and returns a verdict. It cannot approve production policy.
 */
export const securityReview = ({ task, findings = [] } = {}) => {
  const validated = validateTask(task);
  const sensitive = isSecuritySensitive(validated);
  const securityFindings = asFindings(findings);
  const blockers = securityFindings.filter((finding) => finding.severity === "BLOCKER" || finding.severity === "MAJOR");
  return Object.freeze({
    taskId: validated.id,
    required: sensitive,
    reviewed: sensitive,
    findings: Object.freeze(securityFindings),
    blocked: blockers.length > 0,
    verdict: blockers.length > 0 ? "REJECTED" : sensitive ? "APPROVED" : "NOT_REQUIRED"
  });
};

/**
 * Integrated verification: requires all declared gates to pass before a candidate
 * is reported ready. A failing or unrun gate prevents readiness.
 */
export const verifyIntegrated = ({ task, qa, security, review } = {}) => {
  const validated = validateTask(task);
  if (!qa || typeof qa !== "object") throw new Error("qa result is required");
  if (qa.taskId !== validated.id) throw new Error(`qa result taskId mismatch: ${qa.taskId}`);
  const qaVerdict = qa.verdict === "PASSED";
  const reviewVerdict = review ? review.verdict === "APPROVED" : true;
  const securityVerdict = security ? security.verdict === "APPROVED" || security.verdict === "NOT_REQUIRED" : true;
  const ready = qaVerdict && reviewVerdict && securityVerdict;
  return Object.freeze({
    taskId: validated.id,
    qaPassed: qaVerdict,
    reviewPassed: reviewVerdict,
    securityPassed: securityVerdict,
    ready,
    verdict: ready ? "READY" : "NOT_READY"
  });
};

const sanitizeHandoffSections = (sections = {}) => {
  if (!sections || typeof sections !== "object") throw new Error("sections must be an object");
  const allowed = ["outcome", "changedAreas", "acceptance", "architecture", "schema", "remaining", "blockers"];
  const unknown = Object.keys(sections).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`handoff contains prohibited section: ${unknown.join(",")}`);
  const clean = {};
  for (const key of allowed) {
    if (sections[key] !== undefined) clean[key] = asNonEmptyString(sections[key], `sections.${key}`);
  }
  return Object.freeze(clean);
};

/**
 * Handoff adapter: produces a durable, secret-free completion record from the
 * task and adapter results. Rejects secret-bearing fields.
 */
export const buildHandoff = ({ task, branch, commit, qa, security, review, sections = {} } = {}) => {
  const validated = validateTask(task);
  const cleanSections = sanitizeHandoffSections(sections);
  const record = Object.freeze({
    taskId: validated.id,
    owner: validated.owner,
    branch: asNonEmptyString(branch, "branch"),
    commit: asNonEmptyString(commit, "commit"),
    status: "Complete",
    qaVerdict: qa?.verdict ?? "NOT_RUN",
    securityVerdict: security?.verdict ?? "NOT_RUN",
    reviewVerdict: review?.verdict ?? "NOT_RUN",
    sections: cleanSections
  });
  return record;
};

if (process.argv[1] && process.argv[1].endsWith("/control-plane.mjs") && process.argv[2] === "action") {
  const result = evaluateAction({ action: process.argv[3], environment: process.env.PCX_AGENT_ENVIRONMENT ?? "local" });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.allowed) process.exitCode = 1;
}
