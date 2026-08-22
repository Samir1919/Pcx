export const InspectionStatus = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED",
  SUPERSEDED: "SUPERSEDED"
});

export const TestResultStatus = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  NA: "NA"
});

export const ConditionGrade = Object.freeze({
  A_PLUS: "A_PLUS",
  A: "A",
  B: "B",
  C: "C",
  REJECT: "REJECT"
});

const inspectionStatuses = new Set(Object.values(InspectionStatus));
const resultStatuses = new Set(Object.values(TestResultStatus));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

// A physical unit has exactly one active inspection at a time per template
// version; a new inspection supersedes (never overwrites) prior records.
export function createInspection({
  id,
  inventoryItemId,
  inspectionTemplateId,
  technicianUserId,
  status = InspectionStatus.DRAFT,
  startedAt = new Date()
}) {
  if (!inspectionStatuses.has(status)) throw new TypeError("inspection status is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    inspectionTemplateId: requiredString(inspectionTemplateId, "inspectionTemplateId"),
    technicianUserId: requiredString(technicianUserId, "technicianUserId"),
    supervisorUserId: null,
    status,
    startedAt: timestamp(startedAt, "startedAt"),
    submittedAt: null,
    finalizedAt: null,
    notes: null
  });
}

export function createTestResult({
  id,
  inspectionId,
  inspectionTemplateItemId,
  resultStatus,
  valueNumber = null,
  valueText = null,
  passBoolean = null,
  notes = null,
  createdAt = new Date()
}) {
  if (!resultStatuses.has(resultStatus)) throw new TypeError("test result status is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    inspectionId: requiredString(inspectionId, "inspectionId"),
    inspectionTemplateItemId: requiredString(inspectionTemplateItemId, "inspectionTemplateItemId"),
    resultStatus,
    valueNumber: valueNumber == null || valueNumber === "" ? null : Number(valueNumber),
    valueText: valueText == null || valueText === "" ? null : String(valueText),
    passBoolean: passBoolean == null ? null : passBoolean === true,
    notes: notes == null || notes === "" ? null : String(notes),
    createdAt: timestamp(createdAt, "createdAt")
  });
}

// Rule-based, server-owned health score. Critical items weigh three times a
// normal item; unanswered (NA) and non-mandatory items are excluded from the
// weighted average so the score reflects answered critical/normal tests.
// Returns an integer 0–100.
export function computeHealthScore(results, items, formulaVersion = "v1-weighted") {
  const itemsByCode = new Map(items.map((item) => [item.id, item]));
  let weightedScore = 0;
  let weightedTotal = 0;
  const components = [];
  for (const result of results) {
    const item = itemsByCode.get(result.inspectionTemplateItemId);
    if (!item || result.resultStatus === TestResultStatus.NA) continue;
    const weight = item.isCritical ? 3 : 1;
    const pass = result.resultStatus === TestResultStatus.PASS;
    weightedScore += weight * (pass ? 1 : 0);
    weightedTotal += weight;
    components.push({ itemCode: item.code, weight, pass });
  }
  if (weightedTotal === 0) throw new TypeError("at least one answered test is required");
  const score = Math.round((weightedScore / weightedTotal) * 100);
  return Object.freeze({ score, formulaVersion, components: Object.freeze(components) });
}

// Condition grade derives from the server-owned health score plus critical
// failures. A critical failure always rejects regardless of numeric score.
export function suggestGrade(healthScore, { hasCriticalFailure = false } = {}) {
  if (hasCriticalFailure || healthScore.score < 50) return ConditionGrade.REJECT;
  if (healthScore.score >= 90) return ConditionGrade.A_PLUS;
  if (healthScore.score >= 80) return ConditionGrade.A;
  if (healthScore.score >= 65) return ConditionGrade.B;
  return ConditionGrade.C;
}

// A submitted inspection is immutable. The server transitions it into
// SUBMITTED (routine) or ESCALATED (critical failure) using the derived
// health score and grade.
export function submitInspection(inspection, { results, items, submittedAt = new Date() }) {
  if (inspection.status !== InspectionStatus.DRAFT) throw new TypeError("only a draft inspection can be submitted");
  const mandatory = items.filter((item) => item.isMandatory);
  const byId = new Map(results.map((result) => [result.inspectionTemplateItemId, result]));
  for (const item of mandatory) {
    const result = byId.get(item.id);
    if (!result || result.resultStatus === TestResultStatus.NA) throw new TypeError(`mandatory test "${item.code}" is missing`);
  }
  const criticalFailure = items.some((item) => item.isCritical && byId.get(item.id)?.resultStatus === TestResultStatus.FAIL);
  const healthScore = computeHealthScore(results, items);
  const grade = suggestGrade(healthScore, { hasCriticalFailure: criticalFailure });
  return Object.freeze({
    ...inspection,
    status: criticalFailure ? InspectionStatus.ESCALATED : InspectionStatus.SUBMITTED,
    submittedAt: timestamp(submittedAt, "submittedAt"),
    criticalFailure,
    healthScore,
    grade
  });
}

function requireFinalizable(inspection) {
  // Routine SUBMITTED inspections can be approved/rejected directly. ESCALATED
  // (critical-failure) inspections require a separate, reasoned, audited
  // supervisor override — never a plain approve — so a critical failure cannot
  // be silently cleared.
  if (inspection.status !== InspectionStatus.SUBMITTED) {
    throw new TypeError("inspection is not finalizable");
  }
}

// Approved inspections record their verified grade/health on the inventory item.
export function approveInspection(inspection, { supervisorUserId, finalizedAt = new Date() }) {
  requireFinalizable(inspection);
  if (!inspection.healthScore || !inspection.grade) throw new TypeError("inspection has no derived health/grade");
  return Object.freeze({
    ...inspection,
    status: InspectionStatus.APPROVED,
    supervisorUserId: requiredString(supervisorUserId, "supervisorUserId"),
    finalizedAt: timestamp(finalizedAt, "finalizedAt")
  });
}

export function rejectInspection(inspection, { supervisorUserId, finalizedAt = new Date() }) {
  requireFinalizable(inspection);
  return Object.freeze({
    ...inspection,
    status: InspectionStatus.REJECTED,
    supervisorUserId: requiredString(supervisorUserId, "supervisorUserId"),
    finalizedAt: timestamp(finalizedAt, "finalizedAt")
  });
}
