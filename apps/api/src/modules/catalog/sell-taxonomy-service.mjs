import { randomUUID } from "node:crypto";
import { createSellBuildComponent, createSellEntryConfig, hasPermission, Permission, parseBuildComponentRole, parseSellEntryIcon, parseSellEntryKey, parseSellEntryKind, sellEntryKeyFromSlug } from "@pcx/domain";

export class SellTaxonomyError extends Error {
  constructor(code) { super(code); this.name = "SellTaxonomyError"; this.code = code; }
}

const entryFields = new Set(["iconKey", "hint", "sortOrder", "isActive"]);
const createFields = new Set(["categoryId", "kind", "iconKey", "hint", "sortOrder", "isActive"]);
const componentFields = new Set(["role", "categoryId", "required", "sortOrder"]);
const createComponentFields = new Set(["role", "categoryId", "required", "sortOrder"]);
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

function normalizeCreate(input) {
  const value = exact(input, createFields);
  const record = {};
  if (typeof value.categoryId !== "string" || !uuidPattern.test(value.categoryId)) throw new SellTaxonomyError("invalid_input");
  record.categoryId = value.categoryId;
  try { record.kind = parseSellEntryKind(value.kind); } catch { throw new SellTaxonomyError("invalid_input"); }
  try { record.iconKey = parseSellEntryIcon(value.iconKey); } catch { throw new SellTaxonomyError("invalid_input"); }
  if (typeof value.hint !== "string" || value.hint.trim().length === 0) throw new SellTaxonomyError("invalid_input");
  record.hint = value.hint.trim();
  if (!Number.isSafeInteger(value.sortOrder) || Number(value.sortOrder) < 0) throw new SellTaxonomyError("invalid_input");
  record.sortOrder = Number(value.sortOrder);
  if (value.isActive !== undefined) {
    if (typeof value.isActive !== "boolean") throw new SellTaxonomyError("invalid_input");
    record.isActive = value.isActive;
  } else {
    record.isActive = true;
  }
  return record;
}

function normalizeComponent(input) {
  const value = exact(input, componentFields);
  const patch = {};
  if (value.role !== undefined) {
    try { patch.role = parseBuildComponentRole(value.role); } catch { throw new SellTaxonomyError("invalid_input"); }
  }
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

function normalizeCreateComponent(input) {
  const value = exact(input, createComponentFields);
  const record = {};
  try { record.role = parseBuildComponentRole(value.role); } catch { throw new SellTaxonomyError("invalid_input"); }
  if (typeof value.categoryId !== "string" || !uuidPattern.test(value.categoryId)) throw new SellTaxonomyError("invalid_input");
  record.categoryId = value.categoryId;
  if (value.required !== undefined) {
    if (typeof value.required !== "boolean") throw new SellTaxonomyError("invalid_input");
    record.required = value.required;
  } else {
    record.required = false;
  }
  if (value.sortOrder !== undefined) {
    if (!Number.isSafeInteger(value.sortOrder) || Number(value.sortOrder) < 0) throw new SellTaxonomyError("invalid_input");
    record.sortOrder = Number(value.sortOrder);
  } else {
    record.sortOrder = 0;
  }
  return record;
}

export function createSellTaxonomyService({ authService, readRepository, commandRepository, catalogService = null, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!readRepository || typeof readRepository.listEntries !== "function") throw new TypeError("readRepository.listEntries is required");
  if (!commandRepository || ["createEntry", "deleteEntry", "updateEntry", "updateComponent", "createComponent", "deleteComponent"].some((method) => typeof commandRepository[method] !== "function")) throw new TypeError("sell taxonomy command repository is required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.CATALOG_MANAGE)) throw new SellTaxonomyError("forbidden");
    return identity;
  }

  function event(identity, targetType, targetId, requestId, action, changes, occurredAt) {
    return { id: id(), actorId: identity.userId, action, targetType, targetId, requestId: requestId ?? "unavailable", changes, occurredAt };
  }

  // The entry key is derived from the catalog category slug (server-owned), so
  // the caller never authors the canonical identifier.
  async function resolveCategorySlug(categoryId) {
    if (!catalogService || typeof catalogService.listCategories !== "function") throw new SellTaxonomyError("unavailable");
    const result = await catalogService.listCategories();
    const category = (result?.data ?? []).find((c) => c.id === categoryId);
    if (!category) throw new SellTaxonomyError("invalid_reference");
    return category.slug;
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

    async createEntry(accessCredential, input, context = {}) {
      const identity = await actor(accessCredential);
      const value = normalizeCreate(input);
      const now = clock().toISOString();
      // Derive the canonical entry key from the catalog category slug. The
      // category remains the single source of truth; the client only picks which
      // category becomes a sell entry and its presentation metadata.
      const slug = await resolveCategorySlug(value.categoryId);
      const entryKey = sellEntryKeyFromSlug(slug);
      const entry = createSellEntryConfig({
        id: id(),
        entryKey,
        categoryId: value.categoryId,
        kind: value.kind,
        iconKey: value.iconKey,
        hint: value.hint,
        sortOrder: value.sortOrder,
        isActive: value.isActive,
        createdAt: now
      });
      try {
        await commandRepository.createEntry(entry, now, event(identity, "SELL_ENTRY", entryKey, context.requestId, "SELL_ENTRY_CREATED", entry, now));
      } catch (error) {
        if (error?.code === "23505") throw new SellTaxonomyError("already_exists");
        if (error?.code === "23503") throw new SellTaxonomyError("invalid_reference");
        throw error;
      }
      return Object.freeze({ data: Object.freeze({ entryKey, kind: entry.kind, categoryId: entry.categoryId, iconKey: entry.iconKey, hint: entry.hint, sortOrder: entry.sortOrder, isActive: entry.isActive, createdAt: now }) });
    },

    async deleteEntry(accessCredential, entryKey, context = {}) {
      const identity = await actor(accessCredential);
      let key;
      try { key = parseSellEntryKey(entryKey); } catch { throw new SellTaxonomyError("invalid_input"); }
      const now = clock().toISOString();
      const deleted = await commandRepository.deleteEntry(key, event(identity, "SELL_ENTRY", key, context.requestId, "SELL_ENTRY_DELETED", { entryKey: key }, now));
      if (!deleted) throw new SellTaxonomyError("not_found");
      return Object.freeze({ entryKey: key });
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
        if (error?.code === "23505") throw new SellTaxonomyError("already_exists");
        if (error?.code === "23503") throw new SellTaxonomyError("invalid_reference");
        throw error;
      }
      return Object.freeze({ entryKey: key, role: patch.role ?? componentRole, ...patch, updatedAt: now });
    },

    async createComponent(accessCredential, entryKey, input, context = {}) {
      const identity = await actor(accessCredential);
      let key;
      try { key = parseSellEntryKey(entryKey); } catch { throw new SellTaxonomyError("invalid_input"); }
      const value = normalizeCreateComponent(input);
      const now = clock().toISOString();
      const component = createSellBuildComponent({ id: id(), entryKey: key, role: value.role, categoryId: value.categoryId, required: value.required, sortOrder: value.sortOrder, createdAt: now });
      try {
        await commandRepository.createComponent(component, now, event(identity, "SELL_BUILD_COMPONENT", `${key}:${component.role}`, context.requestId, "SELL_BUILD_COMPONENT_CREATED", component, now));
      } catch (error) {
        if (error?.code === "23505") throw new SellTaxonomyError("already_exists");
        if (error?.code === "23503") throw new SellTaxonomyError("invalid_reference");
        throw error;
      }
      return Object.freeze({ entryKey: key, role: component.role, categoryId: component.categoryId, required: component.required, sortOrder: component.sortOrder, createdAt: now });
    },

    async deleteComponent(accessCredential, entryKey, role, context = {}) {
      const identity = await actor(accessCredential);
      let key;
      let componentRole;
      try {
        key = parseSellEntryKey(entryKey);
        componentRole = parseBuildComponentRole(role);
      } catch { throw new SellTaxonomyError("invalid_input"); }
      const now = clock().toISOString();
      const deleted = await commandRepository.deleteComponent(key, componentRole, event(identity, "SELL_BUILD_COMPONENT", `${key}:${componentRole}`, context.requestId, "SELL_BUILD_COMPONENT_DELETED", { role: componentRole }, now));
      if (!deleted) throw new SellTaxonomyError("not_found");
      return Object.freeze({ entryKey: key, role: componentRole });
    }
  });
}
