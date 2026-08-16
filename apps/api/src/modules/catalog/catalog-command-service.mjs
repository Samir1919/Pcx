import { randomUUID } from "node:crypto";
import { createBrand, createCategory, createProductModel, hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class CatalogCommandError extends Error { constructor(code) { super(code); this.name = "CatalogCommandError"; this.code = code; } }

const fields = Object.freeze({
  category: new Set(["parentId", "name", "slug", "sortOrder"]),
  brand: new Set(["name", "slug"]),
  product_model: new Set(["categoryId", "brandId", "name", "slug", "modelCode", "searchAliases"])
});

export function createCatalogCommandService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || ["create","find","update","archive"].some((method) => typeof repository[method] !== "function")) throw new TypeError("catalog command repository is required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.CATALOG_MANAGE)) throw new CatalogCommandError("forbidden");
    return identity;
  }
  function input(kind, value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogCommandError("invalid_input");
    for (const key of Object.keys(value)) if (!fields[kind].has(key)) throw new CatalogCommandError("invalid_input");
    return value;
  }
  function event(identity, kind, targetId, requestId, action, now) {
    return { id: id(), actorId: identity.userId, action, targetType: kind.toUpperCase(), targetId, requestId: requestId ?? "unavailable", changes: { status: action.endsWith("ARCHIVED") ? "ARCHIVED" : "ACTIVE" }, occurredAt: now };
  }
  async function create(kind, accessCredential, value, context) {
    const identity = await actor(accessCredential);
    const now = clock();
    let record;
    try {
      const data = { id: id(), ...input(kind, value), createdAt: now };
      record = kind === "category" ? createCategory(data) : kind === "brand" ? createBrand(data) : createProductModel(data);
      return await repository.create(record, kind, event(identity, kind, record.id, context?.requestId, `CATALOG_${kind.toUpperCase()}_CREATED`, now.toISOString()));
    } catch (error) {
      if (error instanceof CatalogCommandError) throw error;
      if (error?.code === "23503") throw new CatalogCommandError("invalid_reference");
      if (error?.code === "23505") throw new CatalogCommandError("conflict");
      if (error instanceof TypeError) throw new CatalogCommandError("invalid_input");
      throw error;
    }
  }
  return Object.freeze({
    createCategory(access, value, context) { return create("category", access, value, context); },
    createBrand(access, value, context) { return create("brand", access, value, context); },
    createProductModel(access, value, context) { return create("product_model", access, value, context); },
    async update(accessCredential, kind, targetId, patch, context = {}) {
      if (!fields[kind] || typeof targetId !== "string" || !targetId) throw new CatalogCommandError("not_found");
      const identity = await actor(accessCredential);
      const existing = await repository.find(kind, targetId);
      if (!existing) throw new CatalogCommandError("not_found");
      const changes = input(kind, patch);
      if (Object.keys(changes).length === 0) throw new CatalogCommandError("invalid_input");
      const now = clock().toISOString();
      try {
        const source = { ...existing, ...changes, id: existing.id, createdAt: existing.createdAt };
        const record = kind === "category" ? createCategory(source) : kind === "brand" ? createBrand(source) : createProductModel(source);
        const updated = await repository.update(record, kind, now, event(identity, kind, targetId, context.requestId, `CATALOG_${kind.toUpperCase()}_UPDATED`, now));
        if (!updated) throw new CatalogCommandError("not_found");
        return { ...record, updatedAt: now };
      } catch (error) {
        if (error instanceof CatalogCommandError) throw error;
        if (error?.code === "23503") throw new CatalogCommandError("invalid_reference");
        if (error?.code === "23505") throw new CatalogCommandError("conflict");
        if (error instanceof TypeError) throw new CatalogCommandError("invalid_input");
        throw error;
      }
    },
    async archive(accessCredential, kind, targetId, context = {}) {
      if (!fields[kind] || typeof targetId !== "string" || !targetId) throw new CatalogCommandError("not_found");
      const identity = await actor(accessCredential);
      const now = clock().toISOString();
      const archived = await repository.archive(targetId, kind, now, event(identity, kind, targetId, context.requestId, `CATALOG_${kind.toUpperCase()}_ARCHIVED`, now));
      if (!archived) throw new CatalogCommandError("not_found");
    }
  });
}
