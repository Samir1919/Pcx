import { randomUUID } from "node:crypto";
import { hasPermission, Permission, parseBuildComponentRole, parseSellEntryIcon, parseSellEntryKey } from "../../../../../packages/domain/src/index.mjs";

export class SellTaxonomyError extends Error {
  constructor(code) { super(code); this.name = "SellTaxonomyError"; this.code = code; }
}

const entryFields = new Set(["iconKey", "hint", "sortOrder", "isActive"]);
const componentFields = new Set(["categoryId", "required", "sortOrder"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exact(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length === 0) throw new SellTaxonomyError("invalid_input");
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new SellTaxonomyError("invalid_input");
  return input;
}

function normalizeEntry(input) {
  const value = exact(input, entryFields);
  const patch = {};
  if (value.iconKey !== undefined) {
    try { patch.iconKey = parseSellEntryIcon(value.iconKey); } catch { throw new SellTaxonomyError("invalid_input"); }
  }
  if (value.hint !== undefined) {
    if (typeof value.hint !== "string" || value.hint.trim().length === 0) throw new SellTaxonomyError("invalid_input");
    patch.hint = value.hint.trim();
  }
  if (value.sortOrder !== undefined) {
    if (!Number.isSafeInteger(value.sortOrder) || Number(value.sortOrder) < 0) throw new SellTaxonomyError("invalid_input");
    patch.sortOrder = Number(value.sortOrder);
  }
  if (value.isActive !== undefined) {
    if (typeof value.isActive !== "boolean") throw new SellTaxonomyError("invalid_input");
    patch.isActive = value.isActive;
  }
  if (Object.keys(patch).length === 0) throw new SellTaxonomyError("invalid_input");
  return patch;
}

function normalizeComponent(input) {
  const value = exact(input, componentFields);
  const patch = {};
  if (value.categoryId !== undefined) {
    if (typeof value.categoryId !== "string" || !uuidPattern.test(value.categoryId)) throw new SellTaxonomyError("invalid_input");
    patch.categoryId = value.categoryId;
  }
  if (value.required !== undefined) {
    if (typeof value.required !== "boolean") throw new SellTaxonomyError("invalid_input");
    patch.required = value.required;
  }
  if (value.sortOrder !== undefined) {
    if (!Number.isSafeInteger(value.sortOrder) || Number(value.sortOrder) < 0) throw new SellTaxonomyError("invalid_input");
    patch.sortOrder = Number(value.sortOrder);
  }
  if (Object.keys(patch).length === 0) throw new SellTaxonomyError("invalid_input");
  return patch;
}

export function createSellTaxonomyService({ authService, readRepository, commandRepository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!readRepository || typeof readRepository.listEntries !== "function") throw new TypeError("readRepository.listEntries is required");
  if (!commandRepository || typeof commandRepository.updateEntry !== "function" || typeof commandRepository.updateComponent !== "function") throw new TypeError("sell taxonomy command repository is required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.CATALOG_MANAGE)) throw new SellTaxonomyError("forbidden");
    return identity;
  }

  function event(identity, targetType, targetId, requestId, action, changes, occurredAt) {
    return { id: id(), actorId: identity.userId, action, targetType, targetId, requestId: requestId ?? "unavailable", changes, occurredAt };
  }

  return Object.freeze({
    // Public read-only: active sell entries + their build components + part
    // children. Never exposes internal ids beyond what is needed to render
    // and submit a sell request (category ids are public catalog references).
    async publicTaxonomy() {
      return Object.freeze({ data: Object.freeze(await readRepository.listEntries({ activeOnly: true })) });
    },

    // Admin read: full config including inactive entries.
    async listAdmin(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await readRepository.listEntries({ activeOnly: false })) });
    },

    async updateEntry(accessCredential, entryKey, input, context = {}) {
      const identity = await actor(accessCredential);
      let key;
      try { key = parseSellEntryKey(entryKey); } catch { throw new SellTaxonomyError("invalid_input"); }
      const patch = normalizeEntry(input);
      const now = clock().toISOString();
      const updated = await commandRepository.updateEntry(key, patch, now, event(identity, "SELL_ENTRY", key, context.requestId, "SELL_ENTRY_UPDATED", patch, now));
      if (!updated) throw new SellTaxonomyError("not_found");
      return Object.freeze({ entryKey: key, ...patch, updatedAt: now });
    },

    async updateComponent(accessCredential, entryKey, role, input, context = {}) {
      const identity = await actor(accessCredential);
      let key;
      let componentRole;
      try {
        key = parseSellEntryKey(entryKey);
        componentRole = parseBuildComponentRole(role);
      } catch { throw new SellTaxonomyError("invalid_input"); }
      const patch = normalizeComponent(input);
      const now = clock().toISOString();
      try {
        const updated = await commandRepository.updateComponent(key, componentRole, patch, now, event(identity, "SELL_BUILD_COMPONENT", `${key}:${componentRole}`, context.requestId, "SELL_BUILD_COMPONENT_UPDATED", patch, now));
        if (!updated) throw new SellTaxonomyError("not_found");
      } catch (error) {
        if (error instanceof SellTaxonomyError) throw error;
        if (error?.code === "23503") throw new SellTaxonomyError("invalid_reference");
        throw error;
      }
      return Object.freeze({ entryKey: key, role: componentRole, ...patch, updatedAt: now });
    }
  });
}
