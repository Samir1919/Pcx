import { randomUUID } from "node:crypto";
import { assertRequiredSpecificationValues, createBrand, createCategory, createModelSpecificationValue, createProductModel, createProductModelComponent, hasPermission, Permission, setCatalogStatus } from "@pcx/domain";

export class CatalogCommandError extends Error { constructor(code) { super(code); this.name = "CatalogCommandError"; this.code = code; } }

const fields = Object.freeze({
  category: new Set(["parentId", "name", "slug", "sortOrder"]),
  brand: new Set(["name", "slug"]),
  product_model: new Set(["categoryId", "brandId", "name", "slug", "modelCode", "searchAliases"]),
  product_model_build: new Set(["categoryId", "brandId", "name", "slug", "modelCode", "searchAliases", "components"])
});

const componentFields = new Set(["role", "mode", "productModelId", "name", "brandId", "modelCode", "quantity", "sortOrder", "specs"]);

function slugify(value) {
  const slug = String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new CatalogCommandError("invalid_input");
  return slug;
}

function componentInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogCommandError("invalid_input");
  for (const key of Object.keys(value)) if (!componentFields.has(key)) throw new CatalogCommandError("invalid_input");
  if (typeof value.role !== "string" || !value.role) throw new CatalogCommandError("invalid_input");
  if (value.mode !== "existing" && value.mode !== "new") throw new CatalogCommandError("invalid_input");
  if (value.mode === "existing" && typeof value.productModelId !== "string") throw new CatalogCommandError("invalid_input");
  if (value.mode === "new" && (typeof value.name !== "string" || !value.name.trim())) throw new CatalogCommandError("invalid_input");
  return value;
}

export function createCatalogCommandService({ authService, repository, buildRoles = null, listDefinitions = null, listModelSpecifications = null, checkCompatibility = null, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || ["create","find","update","archive","setStatus","listCategories","remove"].some((method) => typeof repository[method] !== "function")) throw new TypeError("catalog command repository is required");

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
  // Validate a new inline part's specs against its component category's
  // per-category definitions and build typed model-spec value records.
  async function buildSpecRecords(part, specsInput) {
    if (typeof listDefinitions !== "function") return { records: [], definitions: [] };
    let definitions;
    try { definitions = await listDefinitions({ categoryId: part.categoryId }); } catch { definitions = []; }
    if (!Array.isArray(definitions)) definitions = [];
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const records = [];
    for (const item of specsInput) {
      if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.definitionId !== "string" || !Object.hasOwn(item, "value")) throw new CatalogCommandError("invalid_input");
      const definition = byId.get(item.definitionId);
      if (!definition) throw new CatalogCommandError("invalid_reference");
      records.push(createModelSpecificationValue({ id: id(), productModel: part, definition, value: item.value, createdAt: part.createdAt }));
    }
    try { assertRequiredSpecificationValues(records, definitions); } catch { throw new CatalogCommandError("invalid_input"); }
    return { records, definitions };
  }
  return Object.freeze({
    createCategory(access, value, context) { return create("category", access, value, context); },
    createBrand(access, value, context) { return create("brand", access, value, context); },
    createProductModel(access, value, context) { return create("product_model", access, value, context); },
    // Atomic build create: the build (composite ProductModel), any inline-created
    // component parts (with typed specs), and the product_model_components links
    // are all created in one server transaction. Each component slot either
    // references an existing part or creates a new one, and the server resolves
    // the role's component category from the build template (never the client).
    async createProductModelBuild(access, value, context = {}) {
      const identity = await actor(access);
      const now = clock();
      const header = input("product_model_build", value);
      if (!Array.isArray(header.components) || header.components.length === 0) throw new CatalogCommandError("invalid_input");
      if (typeof buildRoles !== "function") throw new CatalogCommandError("invalid_reference");
      let roles;
      try { roles = await buildRoles(header.categoryId); } catch { throw new CatalogCommandError("invalid_reference"); }
      if (!Array.isArray(roles) || roles.length === 0) throw new CatalogCommandError("invalid_reference");
      const roleByKey = new Map(roles.map((role) => [role.role, role]));
      const buildId = id();
      const links = [];
      const newParts = [];
      const compatibilityComponents = [];
      const slug = header.slug ?? slugify(header.name);
      for (const raw of header.components) {
        const component = componentInput(raw);
        const role = roleByKey.get(component.role);
        if (!role) throw new CatalogCommandError("invalid_input");
        const quantity = Number.isSafeInteger(component.quantity) && component.quantity > 0 ? component.quantity : 1;
        const sortOrder = Number.isSafeInteger(component.sortOrder) && component.sortOrder >= 0 ? component.sortOrder : links.length;
        if (component.mode === "existing") {
          const existing = await repository.find("product_model", component.productModelId);
          if (!existing || existing.status !== "ACTIVE" || existing.categoryId !== role.componentCategoryId) throw new CatalogCommandError("invalid_reference");
          const existingSpecs = typeof listModelSpecifications === "function" ? await listModelSpecifications(existing.id) : [];
          const specMap = Object.fromEntries((Array.isArray(existingSpecs) ? existingSpecs : []).filter((s) => s?.value != null).map((s) => [s.key, s.value]));
          compatibilityComponents.push({ categoryId: existing.categoryId, specs: specMap });
          links.push(createProductModelComponent({ id: id(), productModelId: buildId, componentModelId: existing.id, quantity, sortOrder, createdAt: now }));
        } else if (component.mode === "new") {
          const part = createProductModel({ id: id(), categoryId: role.componentCategoryId, brandId: component.brandId, name: component.name, slug: slugify(component.name), modelCode: component.modelCode ?? null, searchAliases: component.searchAliases ?? [], createdAt: now });
          const { records: specs, definitions } = await buildSpecRecords(part, component.specs ?? []);
          const keyById = new Map(definitions.map((definition) => [definition.id, definition.key]));
          const specMap = Object.fromEntries(specs.filter((s) => s?.value != null).map((s) => [keyById.get(s.specificationDefinitionId), s.value]).filter(([key]) => key));
          compatibilityComponents.push({ categoryId: part.categoryId, specs: specMap });
          newParts.push({ model: part, specs });
          links.push(createProductModelComponent({ id: id(), productModelId: buildId, componentModelId: part.id, quantity, sortOrder, createdAt: now }));
        } else {
          throw new CatalogCommandError("invalid_input");
        }
      }
      if (typeof checkCompatibility === "function") {
        const result = await checkCompatibility(compatibilityComponents);
        const requiredViolations = (result?.violations ?? []).filter((v) => v.required);
        if (requiredViolations.length > 0) {
          const error = new CatalogCommandError("compatibility_conflict");
          error.violations = requiredViolations;
          throw error;
        }
      }
      const build = createProductModel({ id: buildId, categoryId: header.categoryId, brandId: header.brandId, name: header.name, slug, modelKind: "BUILD", modelCode: header.modelCode ?? null, searchAliases: header.searchAliases ?? [], createdAt: now });
      try {
        return await repository.createBuild(build, links, newParts, event(identity, "product_model", buildId, context.requestId, "CATALOG_PRODUCT_MODEL_BUILD_CREATED", now.toISOString()));
      } catch (error) {
        if (error instanceof CatalogCommandError) throw error;
        if (error?.code === "23503") throw new CatalogCommandError("invalid_reference");
        if (error?.code === "23505") throw new CatalogCommandError("conflict");
        if (error instanceof TypeError) throw new CatalogCommandError("invalid_input");
        throw error;
      }
    },
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
    },

    // Toggle category visibility (ACTIVE ↔ INACTIVE). The server validates the
    // transition via the domain (never ARCHIVED here — archive is separate) and
    // owns the status value; the client only picks the intended state.
    async setStatus(accessCredential, kind, targetId, status, context = {}) {
      if (!fields[kind] || typeof targetId !== "string" || !targetId) throw new CatalogCommandError("not_found");
      if (status !== "ACTIVE" && status !== "INACTIVE") throw new CatalogCommandError("invalid_input");
      const identity = await actor(accessCredential);
      const existing = await repository.find(kind, targetId);
      if (!existing) throw new CatalogCommandError("not_found");
      const now = clock().toISOString();
      try {
        setCatalogStatus(existing, status, { updatedAt: now });
        const updated = await repository.setStatus(targetId, kind, status, now, event(identity, kind, targetId, context.requestId, `CATALOG_${kind.toUpperCase()}_${status === "INACTIVE" ? "DEACTIVATED" : "ACTIVATED"}`, now));
        if (!updated) throw new CatalogCommandError("not_found");
      } catch (error) {
        if (error instanceof CatalogCommandError) throw error;
        if (error instanceof TypeError) throw new CatalogCommandError("invalid_input");
        throw error;
      }
    },

    // Admin read: categories including INACTIVE (never ARCHIVED) so a
    // deactivated category remains visible and can be reactivated.
    async listCategories(accessCredential) {
      await actor(accessCredential);
      if (typeof repository.listCategories !== "function") throw new TypeError("catalog admin list is unavailable");
      return Object.freeze({ data: Object.freeze(await repository.listCategories()) });
    },

    // Admin list of product models including INACTIVE so a deactivated model
    // remains visible and can be reactivated.
    async listProductModels(accessCredential, filters = {}) {
      await actor(accessCredential);
      if (typeof repository.listProductModelsAdmin !== "function") throw new TypeError("catalog admin list is unavailable");
      try {
        const result = await repository.listProductModelsAdmin(filters);
        const records = Array.isArray(result) ? result : result?.records ?? [];
        const nextCursor = Array.isArray(result) ? null : result?.nextCursor ?? null;
        return Object.freeze({ data: Object.freeze(records), meta: Object.freeze({ nextCursor }) });
      } catch (error) {
        if (error instanceof CatalogCommandError) throw error;
        if (error instanceof TypeError) throw new CatalogCommandError("invalid_input");
        throw error;
      }
    },

    // Hard delete (unreferenced only). A referenced record yields `in_use` so the
    // caller can fall back to archive — never a destructive cascade.
    async remove(accessCredential, kind, targetId, context = {}) {
      if (!fields[kind] || typeof targetId !== "string" || !targetId) throw new CatalogCommandError("not_found");
      const identity = await actor(accessCredential);
      const now = clock().toISOString();
      const outcome = await repository.remove(targetId, kind, {
        id: id(),
        actorId: identity.userId,
        action: `CATALOG_${kind.toUpperCase()}_DELETED`,
        targetType: kind.toUpperCase(),
        targetId,
        requestId: context.requestId ?? "unavailable",
        changes: { status: "DELETED" },
        occurredAt: now
      });
      if (outcome.status === "in_use") throw new CatalogCommandError("in_use");
      if (outcome.status !== "deleted") throw new CatalogCommandError("not_found");
    }
  });
}
