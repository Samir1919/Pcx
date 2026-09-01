import { randomUUID } from "node:crypto";
import {
  approveInspection,
  createInspection,
  createTestResult,
  hasPermission,
  InspectionStatus,
  overrideInspection,
  Permission,
  rejectInspection,
  submitInspection
} from "@pcx/domain";

export class InspectionExecutionError extends Error {
  constructor(code) { super(code); this.name = "InspectionExecutionError"; this.code = code; }
}

const resultFields = new Set(["inspectionTemplateItemId", "resultStatus", "valueNumber", "valueText", "passBoolean", "notes"]);

export function createInspectionExecutionService({ authService, inventoryRepository, inspectionTemplateRepository, repository, auditLogService, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["findById"]) if (!inventoryRepository || typeof inventoryRepository[method] !== "function") throw new TypeError(`inventoryRepository.${method} is required`);
  for (const method of ["findById", "listItems"]) if (!inspectionTemplateRepository || typeof inspectionTemplateRepository[method] !== "function") throw new TypeError(`inspectionTemplateRepository.${method} is required`);
  for (const method of ["create", "findById", "findActiveByItem", "listByItem", "upsertResult", "listResults", "submit", "finalize", "supersede"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function technician(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INSPECTION_SUBMIT)) throw new InspectionExecutionError("forbidden");
    return identity;
  }

  async function supervisor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INSPECTION_OVERRIDE)) throw new InspectionExecutionError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new InspectionExecutionError("invalid_input");
    return input ?? {};
  }

  async function record(action, entityId, actorUserId, afterSnapshot) {
    if (!auditLogService) return;
    try {
      await auditLogService.record({ actorUserId, action, entityType: "inspection", entityId, afterSnapshot });
    } catch { /* audit must never fail the business operation */ }
  }

  async function loadTemplateItems(templateId) {
    const template = await inspectionTemplateRepository.findById(templateId);
    if (!template) throw new InspectionExecutionError("template_not_found");
    const items = await inspectionTemplateRepository.listItems(templateId);
    return { template, items };
  }

  return Object.freeze({
    // Begin a DRAFT inspection against a received physical item.
    async start(accessCredential, input) {
      const identity = await technician(accessCredential);
      const fields = exact(input, new Set(["inventoryItemId", "inspectionTemplateId"]));
      const item = await inventoryRepository.findById(fields.inventoryItemId);
      if (!item) throw new InspectionExecutionError("item_not_found");
      const active = await repository.findActiveByItem(fields.inventoryItemId);
      if (active) {
        // A DRAFT is still in progress. A SUBMITTED/ESCALATED inspection is
        // superseded (history preserved) so the item can be re-inspected.
        if (active.status === InspectionStatus.DRAFT) throw new InspectionExecutionError("already_in_progress");
        await repository.supersede(active.id, { supersededAt: clock().toISOString() });
      }
      const { template } = await loadTemplateItems(fields.inspectionTemplateId);
      const now = clock().toISOString();
      let record;
      try {
        record = createInspection({
          id: id(),
          inventoryItemId: fields.inventoryItemId,
          inspectionTemplateId: fields.inspectionTemplateId,
          technicianUserId: identity.userId,
          startedAt: now
        });
      } catch {
        throw new InspectionExecutionError("invalid_input");
      }
      return Object.freeze(await repository.create(record, now));
    },

    // Record or replace one test result while the inspection is still DRAFT.
    async putResult(accessCredential, inspectionId, input) {
      await technician(accessCredential);
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      if (inspection.status !== InspectionStatus.DRAFT) throw new InspectionExecutionError("invalid_state");
      const fields = exact(input, resultFields);
      const { items } = await loadTemplateItems(inspection.inspectionTemplateId);
      const item = items.find((entry) => entry.id === fields.inspectionTemplateItemId);
      if (!item) throw new InspectionExecutionError("invalid_item");
      const now = clock().toISOString();
      let record;
      try {
        record = createTestResult({
          id: id(),
          inspectionId,
          inspectionTemplateItemId: fields.inspectionTemplateItemId,
          resultStatus: fields.resultStatus,
          valueNumber: fields.valueNumber,
          valueText: fields.valueText,
          passBoolean: fields.passBoolean,
          notes: fields.notes,
          createdAt: now
        });
      } catch {
        throw new InspectionExecutionError("invalid_input");
      }
      return Object.freeze(await repository.upsertResult(record, now));
    },

    // Finalize a DRAFT inspection: server computes health score and grade, then
    // moves the inspection to SUBMITTED (routine) or ESCALATED (critical fail).
    async submit(accessCredential, inspectionId) {
      await technician(accessCredential);
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      const results = await repository.listResults(inspectionId);
      const { items } = await loadTemplateItems(inspection.inspectionTemplateId);
      const now = clock();
      let submitted;
      try {
        submitted = submitInspection(inspection, { results, items, submittedAt: now });
      } catch {
        throw new InspectionExecutionError("invalid_state");
      }
      const healthScore = {
        id: id(),
        inventoryItemId: inspection.inventoryItemId,
        score: submitted.healthScore.score,
        formulaVersion: submitted.healthScore.formulaVersion,
        components: submitted.healthScore.components
      };
      const result = await repository.submit(inspectionId, { status: submitted.status, submittedAt: submitted.submittedAt, healthScore, suggestedGrade: submitted.grade }, now.toISOString());
      if (result.status !== "submitted") throw new InspectionExecutionError("invalid_state");
      return Object.freeze({ ...submitted, healthScore: Object.freeze(healthScore) });
    },

    async approve(accessCredential, inspectionId) {
      const identity = await supervisor(accessCredential);
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      const health = await repository.findHealthScore(inspectionId);
      if (!health) throw new InspectionExecutionError("invalid_state");
      const grade = inspection.suggestedGrade;
      // The stored health score and suggested grade are authoritative; we
      // re-derive nothing here.
      const now = clock().toISOString();
      let finalized;
      try {
        finalized = approveInspection({ ...inspection, healthScore: { score: health.score }, grade }, { supervisorUserId: identity.userId, finalizedAt: now });
      } catch {
        throw new InspectionExecutionError("invalid_state");
      }
      const result = await repository.finalize(inspectionId, { status: finalized.status, supervisorUserId: finalized.supervisorUserId, finalizedAt: finalized.finalizedAt, grade: finalized.grade, score: health.score }, now);
      if (result.status !== "finalized") throw new InspectionExecutionError("invalid_state");
      await record("INSPECTION_APPROVED", inspectionId, identity.userId, { status: "APPROVED", grade: finalized.grade });
      return Object.freeze(finalized);
    },

    async reject(accessCredential, inspectionId) {
      const identity = await supervisor(accessCredential);
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      const health = await repository.findHealthScore(inspectionId);
      const now = clock().toISOString();
      let finalized;
      try {
        finalized = rejectInspection(inspection, { supervisorUserId: identity.userId, finalizedAt: now });
      } catch {
        throw new InspectionExecutionError("invalid_state");
      }
      const result = await repository.finalize(inspectionId, { status: finalized.status, supervisorUserId: finalized.supervisorUserId, finalizedAt: finalized.finalizedAt, grade: null, score: health?.score ?? null }, now);
      if (result.status !== "finalized") throw new InspectionExecutionError("invalid_state");
      await record("INSPECTION_REJECTED", inspectionId, identity.userId, { status: "REJECTED" });
      return Object.freeze(finalized);
    },

    // A critical-failure (ESCALATED) inspection is cleared only through a
    // separate, reasoned, audited supervisor override — never a plain approve.
    async override(accessCredential, inspectionId, input) {
      const identity = await supervisor(accessCredential);
      const fields = exact(input, new Set(["grade", "reason"]));
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      if (inspection.status !== InspectionStatus.ESCALATED) throw new InspectionExecutionError("invalid_state");
      const health = await repository.findHealthScore(inspectionId);
      if (!health) throw new InspectionExecutionError("invalid_state");
      const now = clock().toISOString();
      let finalized;
      try {
        finalized = overrideInspection(inspection, { supervisorUserId: identity.userId, grade: fields.grade, reason: fields.reason, finalizedAt: now });
      } catch {
        throw new InspectionExecutionError("invalid_input");
      }
      const result = await repository.finalize(inspectionId, { status: finalized.status, supervisorUserId: finalized.supervisorUserId, finalizedAt: finalized.finalizedAt, grade: finalized.grade, score: health.score, notes: finalized.notes }, now);
      if (result.status !== "finalized") throw new InspectionExecutionError("invalid_state");
      await record("INSPECTION_OVERRIDDEN", inspectionId, identity.userId, { status: "APPROVED", grade: finalized.grade, reason: finalized.notes });
      return Object.freeze(finalized);
    },

    async get(accessCredential, inspectionId) {
      await technician(accessCredential);
      const inspection = await repository.findById(inspectionId);
      if (!inspection) throw new InspectionExecutionError("not_found");
      const { items } = await loadTemplateItems(inspection.inspectionTemplateId);
      const results = await repository.listResults(inspectionId);
      const health = await repository.findHealthScore(inspectionId);
      return Object.freeze({ ...inspection, items: Object.freeze(items), results: Object.freeze(results), healthScore: health });
    },

    async list(accessCredential, inventoryItemId) {
      await technician(accessCredential);
      return Object.freeze(await repository.listByItem(inventoryItemId));
    }
  });
}

