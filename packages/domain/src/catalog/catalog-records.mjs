export const CatalogStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED"
});

const forbiddenProductModelFields = new Set([
  "serial",
  "serialNumber",
  "pcxItemId",
  "condition",
  "conditionGrade",
  "health",
  "healthScore",
  "purchaseCost",
  "acquisitionCost",
  "sellingPrice",
  "price",
  "warranty",
  "warrantyEligibility"
]);

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function canonicalSlug(value) {
  const slug = requiredString(value, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new TypeError("slug must be canonical lowercase kebab-case");
  }
  return slug;
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function catalogBase({ id, name, slug, status = CatalogStatus.ACTIVE, createdAt = new Date() }) {
  if (status !== CatalogStatus.ACTIVE && status !== CatalogStatus.INACTIVE) throw new TypeError("status must be ACTIVE or INACTIVE");
  const now = timestamp(createdAt, "createdAt");
  return {
    id: requiredString(id, "id"),
    name: requiredString(name, "name"),
    slug: canonicalSlug(slug),
    status,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
}

export function createCategory({ id, parentId, name, slug, sortOrder = 0, status = CatalogStatus.ACTIVE, createdAt }) {
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) throw new TypeError("sortOrder must be a non-negative integer");
  return Object.freeze({
    ...catalogBase({ id, name, slug, status, createdAt }),
    parentId: optionalString(parentId, "parentId"),
    sortOrder
  });
}

export function createBrand({ id, name, slug, createdAt }) {
  return Object.freeze(catalogBase({ id, name, slug, createdAt }));
}

function normalizedAliases(values = []) {
  if (!Array.isArray(values)) throw new TypeError("searchAliases must be an array");
  const aliases = values.map((value) => requiredString(value, "searchAlias").toLowerCase());
  return Object.freeze([...new Set(aliases)]);
}

export function createProductModel(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("product model input is required");
  for (const field of forbiddenProductModelFields) {
    if (Object.hasOwn(input, field)) throw new TypeError(`${field} belongs to a physical/commercial record, not ProductModel`);
  }

  const base = catalogBase(input);
  return Object.freeze({
    ...base,
    categoryId: requiredString(input.categoryId, "categoryId"),
    brandId: requiredString(input.brandId, "brandId"),
    modelCode: optionalString(input.modelCode, "modelCode"),
    searchAliases: normalizedAliases(input.searchAliases)
  });
}

export function archiveCatalogRecord(record, { archivedAt = new Date() } = {}) {
  if (!record || typeof record !== "object" || typeof record.id !== "string") throw new TypeError("catalog record is required");
  if (record.status === CatalogStatus.ARCHIVED) return record;
  if (record.status !== CatalogStatus.ACTIVE) throw new TypeError("catalog record has an unknown status");
  const archived = timestamp(archivedAt, "archivedAt");
  return Object.freeze({ ...record, status: CatalogStatus.ARCHIVED, updatedAt: archived, archivedAt: archived });
}

// Toggle visibility without deleting: ACTIVE ↔ INACTIVE. Archiving is a
// separate, audited transition (archiveCatalogRecord) so this only allows the
// reversible ACTIVE/INACTIVE pair and never resurrects an archived record.
export function setCatalogStatus(record, status, { updatedAt = new Date() } = {}) {
  if (!record || typeof record !== "object" || typeof record.id !== "string") throw new TypeError("catalog record is required");
  if (status !== CatalogStatus.ACTIVE && status !== CatalogStatus.INACTIVE) throw new TypeError("catalog status must be ACTIVE or INACTIVE");
  if (record.status === CatalogStatus.ARCHIVED) throw new TypeError("archived catalog record cannot be reactivated");
  if (record.status !== CatalogStatus.ACTIVE && record.status !== CatalogStatus.INACTIVE) throw new TypeError("catalog record has an unknown status");
  const updated = timestamp(updatedAt, "updatedAt");
  return Object.freeze({ ...record, status, updatedAt: updated, archivedAt: null });
}
