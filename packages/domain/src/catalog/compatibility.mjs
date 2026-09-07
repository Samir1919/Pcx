// Component compatibility: reference values (shared controlled vocabulary) and
// data-driven compatibility rules between two category-scoped spec attributes.
// Both are admin-managed data (CRUD), so a new socket / memory type / form
// factor is added as a reference value — never a code or UI change.

export const CompatibilityOperator = Object.freeze({
  EQUALS: "EQUALS"
});

const supportedOperators = new Set(Object.values(CompatibilityOperator));
const keyPattern = /^[a-z][a-z0-9_]*$/;

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function canonicalKey(value, name) {
  const key = requiredString(value, name);
  if (!keyPattern.test(key)) throw new TypeError(`${name} must be canonical lowercase snake_case`);
  return key;
}

function timestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("invalid timestamp");
  return date.toISOString();
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

// A shared controlled-vocabulary value (e.g. socket = AM4, memory_type = DDR5).
// SELECT spec definitions point at a referenceKey, so every category using that
// key shares the same list of allowed values.
export function createReferenceValue({ id, key, value, label, sortOrder = 0, createdAt = new Date() }) {
  const now = timestamp(createdAt);
  return Object.freeze({
    id: requiredString(id, "id"),
    key: canonicalKey(key, "key"),
    value: requiredString(value, "value"),
    label: requiredString(label, "label"),
    sortOrder: nonNegativeInteger(sortOrder, "sortOrder"),
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  });
}

// A compatibility rule: `source_category.source_key OP target_category.target_key`.
export function createCompatibilityRule({
  id,
  sourceCategoryId,
  sourceKey,
  operator,
  targetCategoryId,
  targetKey,
  required = true,
  reason,
  sortOrder = 0,
  createdAt = new Date()
}) {
  if (!supportedOperators.has(operator)) throw new TypeError("unsupported compatibility operator");
  const now = timestamp(createdAt);
  return Object.freeze({
    id: requiredString(id, "id"),
    sourceCategoryId: requiredString(sourceCategoryId, "sourceCategoryId"),
    sourceKey: canonicalKey(sourceKey, "sourceKey"),
    operator,
    targetCategoryId: requiredString(targetCategoryId, "targetCategoryId"),
    targetKey: canonicalKey(targetKey, "targetKey"),
    required: boolean(required, "required"),
    reason: requiredString(reason, "reason"),
    sortOrder: nonNegativeInteger(sortOrder, "sortOrder"),
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  });
}

// Evaluate active rules against a set of components. A component is
// `{ categoryId, specs: { [key]: value } }` (spec values already resolved to
// their canonical strings). Returns a list of violations; empty = compatible.
export function evaluateCompatibility(rules, components) {
  if (!Array.isArray(rules)) throw new TypeError("compatibility rules must be an array");
  if (!Array.isArray(components)) throw new TypeError("components must be an array");

  const byCategory = new Map();
  for (const component of components) {
    if (!component || typeof component !== "object") continue;
    const list = byCategory.get(component.categoryId) ?? [];
    list.push(component);
    byCategory.set(component.categoryId, list);
  }

  const violations = [];
  for (const rule of rules) {
    if (!rule || rule.status !== "ACTIVE") continue;
    const sources = byCategory.get(rule.sourceCategoryId) ?? [];
    const targets = byCategory.get(rule.targetCategoryId) ?? [];
    if (sources.length === 0 || targets.length === 0) continue;
    for (const source of sources) {
      const sourceValue = source.specs?.[rule.sourceKey];
      if (sourceValue == null || sourceValue === "") continue;
      for (const target of targets) {
        const targetValue = target.specs?.[rule.targetKey];
        if (targetValue == null || targetValue === "") continue;
        const compatible = sourceValue === targetValue;
        if (!compatible) {
          violations.push(Object.freeze({
            ruleId: rule.id,
            reason: rule.reason,
            sourceCategoryId: rule.sourceCategoryId,
            sourceKey: rule.sourceKey,
            sourceValue,
            targetCategoryId: rule.targetCategoryId,
            targetKey: rule.targetKey,
            targetValue,
            required: rule.required
          }));
        }
      }
    }
  }
  return Object.freeze(violations);
}
