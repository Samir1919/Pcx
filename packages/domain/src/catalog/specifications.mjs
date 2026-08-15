import { CatalogStatus } from "./catalog-records.mjs";

export const SpecificationDataType = Object.freeze({
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON"
});

const supportedTypes = new Set(Object.values(SpecificationDataType));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateJsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JSON specification value contains a non-finite number");
    return;
  }
  if (typeof value !== "object") throw new TypeError("JSON specification value contains an unsupported type");
  if (seen.has(value)) throw new TypeError("JSON specification value must be JSON-serializable");
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError("JSON specification value must use plain objects and arrays");
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new TypeError("JSON specification value contains an unsafe key");
    }
    validateJsonValue(child, seen);
  }
  seen.delete(value);
}

function jsonClone(value) {
  if (value == null || typeof value !== "object") throw new TypeError("JSON specification value must be an object or array");
  validateJsonValue(value);
  try {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
  } catch {
    throw new TypeError("JSON specification value must be JSON-serializable");
  }
}

export function createSpecificationDefinition({
  id,
  categoryId,
  key,
  label,
  dataType,
  unit,
  filterable = false,
  required = false,
  sortOrder = 0,
  createdAt = new Date()
}) {
  const canonicalKey = requiredString(key, "key");
  if (!/^[a-z][a-z0-9_]*$/.test(canonicalKey)) throw new TypeError("key must be canonical lowercase snake_case");
  if (!supportedTypes.has(dataType)) throw new TypeError("unsupported specification dataType");
  if (typeof filterable !== "boolean" || typeof required !== "boolean") throw new TypeError("filterable and required must be booleans");
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) throw new TypeError("sortOrder must be a non-negative integer");
  if (filterable && dataType === SpecificationDataType.JSON) throw new TypeError("JSON specifications cannot be filterable");

  const now = timestamp(createdAt, "createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    categoryId: requiredString(categoryId, "categoryId"),
    key: canonicalKey,
    label: requiredString(label, "label"),
    dataType,
    unit: optionalString(unit, "unit"),
    filterable,
    required,
    sortOrder,
    status: CatalogStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  });
}

function typedValue(dataType, value) {
  if (dataType === SpecificationDataType.TEXT) return requiredString(value, "value");
  if (dataType === SpecificationDataType.NUMBER) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("value must be a finite number");
    return value;
  }
  if (dataType === SpecificationDataType.BOOLEAN) {
    if (typeof value !== "boolean") throw new TypeError("value must be a boolean");
    return value;
  }
  if (dataType === SpecificationDataType.JSON) return jsonClone(value);
  throw new TypeError("unsupported specification dataType");
}

export function createModelSpecificationValue({ id, productModel, definition, value, createdAt = new Date() }) {
  if (!productModel || typeof productModel !== "object") throw new TypeError("productModel is required");
  if (!definition || typeof definition !== "object") throw new TypeError("definition is required");
  if (productModel.categoryId !== definition.categoryId) throw new TypeError("specification definition category does not match ProductModel");
  if (definition.status !== CatalogStatus.ACTIVE) throw new TypeError("specification definition must be active");

  return Object.freeze({
    id: requiredString(id, "id"),
    productModelId: requiredString(productModel.id, "productModel.id"),
    specificationDefinitionId: requiredString(definition.id, "definition.id"),
    dataType: definition.dataType,
    value: typedValue(definition.dataType, value),
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function assertUniqueModelSpecificationValues(values) {
  if (!Array.isArray(values)) throw new TypeError("model specification values must be an array");
  const modelIds = new Set();
  const definitionIds = new Set();
  for (const value of values) {
    if (!value || typeof value !== "object") throw new TypeError("invalid model specification value");
    modelIds.add(value.productModelId);
    if (definitionIds.has(value.specificationDefinitionId)) throw new TypeError("duplicate specification definition for ProductModel");
    definitionIds.add(value.specificationDefinitionId);
  }
  if (modelIds.size > 1) throw new TypeError("specification value set must belong to one ProductModel");
  return values;
}
