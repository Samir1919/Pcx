export const InspectionTemplateStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
});

export const InspectionResultType = Object.freeze({
  PASS_FAIL: "PASS_FAIL",
  NUMBER: "NUMBER",
  TEXT: "TEXT",
  SELECT: "SELECT",
  BOOLEAN: "BOOLEAN"
});

const resultTypes = new Set(Object.values(InspectionResultType));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

// A published template version is immutable; changes require a new version.
export function createInspectionTemplate({
  id,
  categoryId,
  name,
  version,
  status = InspectionTemplateStatus.ACTIVE,
  createdAt = new Date()
}) {
  const nameValue = requiredString(name, "name");
  const versionValue = requiredString(version, "version");
  if (status !== InspectionTemplateStatus.ACTIVE && status !== InspectionTemplateStatus.ARCHIVED) throw new TypeError("template status is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    categoryId: requiredString(categoryId, "categoryId"),
    name: nameValue,
    version: versionValue,
    status,
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function createInspectionTemplateItem({
  id,
  templateId,
  code,
  label,
  resultType,
  unit = null,
  isMandatory = false,
  isCritical = false,
  sortOrder = 0,
  createdAt = new Date()
}) {
  if (!/^[a-z][a-z0-9_]*$/.test(requiredString(code, "code"))) throw new TypeError("code must be canonical lowercase snake_case");
  if (!resultTypes.has(resultType)) throw new TypeError("resultType is invalid");
  if (isCritical === true && resultType === InspectionResultType.TEXT) throw new TypeError("critical items cannot be plain TEXT");
  return Object.freeze({
    id: requiredString(id, "id"),
    templateId: requiredString(templateId, "templateId"),
    code: requiredString(code, "code"),
    label: requiredString(label, "label"),
    resultType,
    unit: unit == null || unit === "" ? null : requiredString(unit, "unit"),
    isMandatory: isMandatory === true,
    isCritical: isCritical === true,
    sortOrder: Number.isSafeInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function assertUniqueInspectionTemplateItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError("at least one inspection template item is required");
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.code)) throw new TypeError(`duplicate inspection template item code: ${item.code}`);
    seen.add(item.code);
  }
  return items;
}
