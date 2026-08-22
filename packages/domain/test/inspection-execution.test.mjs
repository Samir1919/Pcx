import test from "node:test";
import assert from "node:assert/strict";
import {
  computeHealthScore,
  ConditionGrade,
  createInspection,
  createTestResult,
  InspectionStatus,
  submitInspection,
  suggestGrade,
  approveInspection,
  rejectInspection
} from "../src/inspection/inspection-execution.mjs";

const items = [
  { id: "i-cpu", code: "cpu", isCritical: true, isMandatory: true },
  { id: "i-ram", code: "ram", isCritical: false, isMandatory: true },
  { id: "i-cosmetic", code: "cosmetic", isCritical: false, isMandatory: false }
];

function result(itemId, status) {
  return createTestResult({ id: `r-${itemId}`, inspectionId: "insp", inspectionTemplateItemId: itemId, resultStatus: status });
}

test("computeHealthScore weights critical items three times", () => {
  const score = computeHealthScore([result("i-cpu", "PASS"), result("i-ram", "FAIL"), result("i-cosmetic", "PASS")], items);
  // weights: cpu critical=3*pass(1)=3, ram=1*fail(0)=0, cosmetic normal=1*pass(1)=1
  // total weight 5, weighted 4 -> 80
  assert.equal(score.score, 80);
});

test("computeHealthScore ignores NA and non-mandatory unanswered", () => {
  const score = computeHealthScore([result("i-cpu", "PASS"), result("i-ram", "PASS")], items);
  // cpu 3 + ram 1 = 4/4 => 100
  assert.equal(score.score, 100);
});

test("suggestGrade maps health to grades and critical failure rejects", () => {
  assert.equal(suggestGrade({ score: 95 }, {}), ConditionGrade.A_PLUS);
  assert.equal(suggestGrade({ score: 85 }, {}), ConditionGrade.A);
  assert.equal(suggestGrade({ score: 70 }, {}), ConditionGrade.B);
  assert.equal(suggestGrade({ score: 55 }, {}), ConditionGrade.C);
  assert.equal(suggestGrade({ score: 95 }, { hasCriticalFailure: true }), ConditionGrade.REJECT);
});

test("submitInspection enforces mandatory items", () => {
  const inspection = createInspection({ id: "insp", inventoryItemId: "item", inspectionTemplateId: "tpl", technicianUserId: "tech" });
  const missing = [result("i-cpu", "PASS"), result("i-ram", "NA")];
  assert.throws(() => submitInspection(inspection, { results: missing, items }), /mandatory test/);
});

test("submitInspection escalates on critical failure and derives health/grade", () => {
  const inspection = createInspection({ id: "insp", inventoryItemId: "item", inspectionTemplateId: "tpl", technicianUserId: "tech" });
  const submitted = submitInspection(inspection, {
    results: [result("i-cpu", "FAIL"), result("i-ram", "PASS")],
    items
  });
  assert.equal(submitted.status, InspectionStatus.ESCALATED);
  assert.equal(submitted.grade, ConditionGrade.REJECT);
  assert.equal(submitted.healthScore.score, 25); // cpu critical fail: 3*0 + ram 1*1 => 1/4 = 25
});

test("approveInspection requires derived health/grade and rejects non-finalizable", () => {
  const draft = createInspection({ id: "insp", inventoryItemId: "item", inspectionTemplateId: "tpl", technicianUserId: "tech" });
  assert.throws(() => approveInspection(draft, { supervisorUserId: "sup" }), /not finalizable/);

  const submitted = submitInspection(draft, { results: [result("i-cpu", "PASS"), result("i-ram", "PASS")], items });
  const approved = approveInspection({ ...submitted, healthScore: submitted.healthScore, grade: submitted.grade }, { supervisorUserId: "sup" });
  assert.equal(approved.status, InspectionStatus.APPROVED);
  assert.equal(approved.grade, ConditionGrade.A_PLUS);

  const rejected = rejectInspection({ ...submitted, healthScore: submitted.healthScore, grade: submitted.grade }, { supervisorUserId: "sup" });
  assert.equal(rejected.status, InspectionStatus.REJECTED);
});
