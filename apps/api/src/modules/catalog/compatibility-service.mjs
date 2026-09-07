import { randomUUID } from "node:crypto";
import { createCompatibilityRule, createReferenceValue, evaluateCompatibility, hasPermission, Permission } from "@pcx/domain";

export class CompatibilityError extends Error { constructor(code) { super(code); this.name = "CompatibilityError"; this.code = code; } }

const referenceFields = new Set(["key", "value", "label", "sortOrder"]);
const ruleFields = new Set(["sourceCategoryId", "sourceKey", "operator", "targetCategoryId", "targetKey", "required", "reason", "sortOrder"]);

function exact(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CompatibilityError("invalid_input");
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new CompatibilityError("invalid_input");
  return value;
}

export function createCompatibilityService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || typeof repository.listRules !== "function" || typeof repository.listReferenceValues !== "function") throw new TypeError("compatibility repository is required");

  async function actor(access) {
    const identity = await authService.authenticateAccess({ accessCredential: access });
    if (!hasPermission(identity, Permission.CATALOG_MANAGE)) throw new CompatibilityError("forbidden");
    return identity;
  }
  function event(identity, targetType, targetId, requestId, action, now) {
    return { id: id(), actorId: identity.userId, action, targetType, targetId, requestId: requestId ?? "unavailable", changes: { action }, occurredAt: now };
  }
  function map(error) {
    if (error instanceof CompatibilityError) throw error;
    if (error?.code === "23503") throw new CompatibilityError("invalid_reference");
    if (error?.code === "23505") throw new CompatibilityError("conflict");
    if (error instanceof TypeError) throw new CompatibilityError("invalid_input");
    throw error;
  }

  return Object.freeze({
    // Public catalog metadata (reference values + rules) — no auth needed to
    // render SELECT dropdowns and compatible-part filtering.
    async listReferenceValues() { return Object.freeze({ data: Object.freeze(await repository.listReferenceValues()) }); },
    async listRules() { return Object.freeze({ data: Object.freeze(await repository.listRules()) }); },

    async createReferenceValue(access, value, context = {}) {
      const identity = await actor(access);
      const now = clock();
      try {
        const record = createReferenceValue({ id: id(), ...exact(value, referenceFields), createdAt: now });
        return await repository.createReferenceValue(record, event(identity, "REFERENCE_VALUE", record.id, context.requestId, "CATALOG_REFERENCE_VALUE_CREATED", now.toISOString()));
      } catch (error) { map(error); }
    },
    async archiveReferenceValue(access, targetId, context = {}) {
      const identity = await actor(access);
      const now = clock().toISOString();
      const ok = await repository.archiveReferenceValue(targetId, now, event(identity, "REFERENCE_VALUE", targetId, context.requestId, "CATALOG_REFERENCE_VALUE_ARCHIVED", now));
      if (!ok) throw new CompatibilityError("not_found");
    },
    async createRule(access, value, context = {}) {
      const identity = await actor(access);
      const now = clock();
      try {
        const record = createCompatibilityRule({ id: id(), ...exact(value, ruleFields), createdAt: now });
        return await repository.createRule(record, event(identity, "COMPATIBILITY_RULE", record.id, context.requestId, "CATALOG_COMPATIBILITY_RULE_CREATED", now.toISOString()));
      } catch (error) { map(error); }
    },
    async archiveRule(access, targetId, context = {}) {
      const identity = await actor(access);
      const now = clock().toISOString();
      const ok = await repository.archiveRule(targetId, now, event(identity, "COMPATIBILITY_RULE", targetId, context.requestId, "CATALOG_COMPATIBILITY_RULE_ARCHIVED", now));
      if (!ok) throw new CompatibilityError("not_found");
    },
    // Evaluate a build's components against every active rule (server-owned).
    // `components` = [{ categoryId, specs: { [key]: value } }].
    async check(components) {
      const rules = await repository.listRules();
      return Object.freeze({ violations: evaluateCompatibility(rules, components) });
    }
  });
}
