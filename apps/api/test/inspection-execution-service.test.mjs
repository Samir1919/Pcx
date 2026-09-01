import test from "node:test";
import assert from "node:assert/strict";
import { createInspectionExecutionService, InspectionExecutionError } from "../src/modules/inspection/inspection-execution-service.mjs";
import { InspectionStatus } from "@pcx/domain";

function technician() {
  return { userId: "tech-1", status: "ACTIVE", roles: ["TECHNICIAN"] };
}
function supervisor() {
  return { userId: "sup-1", status: "ACTIVE", roles: ["SUPERVISOR"] };
}

function authFor(identity) {
  return { authenticateAccess: async () => identity };
}

const items = [
  { id: "item-1", code: "cpu", isCritical: true, isMandatory: true, resultType: "PASS_FAIL" },
  { id: "item-2", code: "ram", isCritical: false, isMandatory: true, resultType: "PASS_FAIL" }
];

function repo() {
  const store = new Map();
  const results = new Map();
  return {
    async create(record) { store.set(record.id, record); return record; },
    async findById(id) { return store.get(id) ?? null; },
    async findActiveByItem(itemId) { return [...store.values()].find((r) => r.inventoryItemId === itemId && ["DRAFT", "SUBMITTED", "ESCALATED"].includes(r.status)) ?? null; },
    async listByItem() { return [...store.values()]; },
    async upsertResult(record) { results.set(record.inspectionTemplateItemId, record); return record; },
    async listResults() { return [...results.values()]; },
    async submit(id, payload) { store.set(id, { ...store.get(id), status: payload.status, suggestedGrade: payload.suggestedGrade, submittedAt: payload.submittedAt }); return { status: "submitted" }; },
    async finalize(id, payload) { const r = store.get(id); if (r) store.set(id, { ...r, status: payload.status, supervisorUserId: payload.supervisorUserId, finalizedAt: payload.finalizedAt, notes: payload.notes ?? r.notes }); return { status: "finalized", itemId: "item-1" }; },
    async supersede(id, { supersededAt }) { const r = store.get(id); if (r) store.set(id, { ...r, status: "SUPERSEDED", finalizedAt: supersededAt }); return { status: "superseded" }; },
    async findHealthScore() { return { id: "h", score: 100, inventoryItemId: "item-1" }; }
  };
}

function service({ identity = technician(), repository = repo() } = {}) {
  let seq = 0;
  return createInspectionExecutionService({
    authService: authFor(identity),
    inventoryRepository: { findById: async () => ({ id: "item-1", status: "RECEIVED" }) },
    inspectionTemplateRepository: {
      findById: async () => ({ id: "tpl", categoryId: "cat" }),
      listItems: async () => items
    },
    repository,
    id: () => `id-${++seq}`,
    clock: () => new Date("2026-01-01T00:00:00Z")
  });
}

test("start creates a draft inspection for a received item", async () => {
  const s = service();
  const record = await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  assert.equal(record.status, InspectionStatus.DRAFT);
  assert.equal(record.technicianUserId, "tech-1");
});

test("start rejects a second active inspection for the same item", async () => {
  const repository = repo();
  const s = service({ repository });
  await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  await assert.rejects(() => s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" }), (e) => e instanceof InspectionExecutionError && e.code === "already_in_progress");
});

test("putResult replaces a draft test result", async () => {
  const repository = repo();
  const s = service({ repository });
  const record = await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  const result = await s.putResult("token", record.id, { inspectionTemplateItemId: "item-1", resultStatus: "PASS" });
  assert.equal(result.resultStatus, "PASS");
});

test("submit enforces mandatory items and derives health/grade", async () => {
  const repository = repo();
  const s = service({ repository });
  const record = await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  await s.putResult("token", record.id, { inspectionTemplateItemId: "item-1", resultStatus: "PASS" });
  // Missing mandatory item-2 -> invalid_state
  await assert.rejects(() => s.submit("token", record.id), (e) => e instanceof InspectionExecutionError && e.code === "invalid_state");

  await s.putResult("token", record.id, { inspectionTemplateItemId: "item-2", resultStatus: "PASS" });
  const submitted = await s.submit("token", record.id);
  assert.equal(submitted.status, InspectionStatus.SUBMITTED);
  assert.equal(submitted.healthScore.score, 100);
});

test("supervisor approve finalizes and requires override permission", async () => {
  const repository = repo();
  const tech = service({ repository });
  const record = await tech.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  await tech.putResult("token", record.id, { inspectionTemplateItemId: "item-1", resultStatus: "PASS" });
  await tech.putResult("token", record.id, { inspectionTemplateItemId: "item-2", resultStatus: "PASS" });
  const submitted = await tech.submit("token", record.id);

  // A technician cannot approve.
  await assert.rejects(() => tech.approve("token", record.id), (e) => e instanceof InspectionExecutionError && e.code === "forbidden");

  const sup = service({ identity: supervisor(), repository });
  const approved = await sup.approve("token", record.id);
  assert.equal(approved.status, InspectionStatus.APPROVED);
});

test("supervisor override clears a critical-failure (ESCALATED) inspection with a reason", async () => {
  const repository = repo();
  const tech = service({ repository });
  const record = await tech.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  await tech.putResult("token", record.id, { inspectionTemplateItemId: "item-1", resultStatus: "FAIL" });
  await tech.putResult("token", record.id, { inspectionTemplateItemId: "item-2", resultStatus: "PASS" });
  const escalated = await tech.submit("token", record.id);
  assert.equal(escalated.status, InspectionStatus.ESCALATED);

  // A technician cannot override.
  await assert.rejects(() => tech.override("token", record.id, { grade: "A", reason: "x" }), (e) => e.code === "forbidden");

  // A supervisor override requires a grade + reason.
  const sup = service({ identity: supervisor(), repository });
  const overridden = await sup.override("token", record.id, { grade: "B", reason: "Cosmetic only" });
  assert.equal(overridden.status, InspectionStatus.APPROVED);
  assert.equal(overridden.grade, "B");
  assert.equal(overridden.notes, "Cosmetic only");
});

test("start supersedes a prior SUBMITTED inspection to allow reinspection", async () => {
  const repository = repo();
  const s = service({ repository });
  const first = await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  await s.putResult("token", first.id, { inspectionTemplateItemId: "item-1", resultStatus: "PASS" });
  await s.putResult("token", first.id, { inspectionTemplateItemId: "item-2", resultStatus: "PASS" });
  await s.submit("token", first.id);

  // A new inspection supersedes the SUBMITTED one (history preserved).
  const second = await s.start("token", { inventoryItemId: "item-1", inspectionTemplateId: "tpl" });
  assert.equal(second.status, InspectionStatus.DRAFT);
  assert.equal((await repository.findById(first.id)).status, "SUPERSEDED");
});
