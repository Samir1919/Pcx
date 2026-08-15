export const InventoryItemStatus = Object.freeze({
  RECEIVED: "RECEIVED",
  INSPECTION: "INSPECTION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED"
});

export const SerialIdentifierType = Object.freeze({
  SERIAL: "SERIAL",
  IMEI: "IMEI",
  SERVICE_TAG: "SERVICE_TAG",
  OTHER: "OTHER"
});

const identifierTypes = new Set(Object.values(SerialIdentifierType));
const statuses = new Set(Object.values(InventoryItemStatus));

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

// Serial identifiers are normalized (trimmed, upper-cased) before persistence so
// the same physical unit cannot be registered twice with minor formatting.
export function normalizeSerialIdentifier(value) {
  const normalized = requiredString(value, "value").toUpperCase();
  if (normalized.length > 128) throw new TypeError("serial identifier is too long");
  return normalized;
}

export function createInventoryItem({
  id,
  productModelId,
  acquisitionId = null,
  pcxItemId = null,
  status = InventoryItemStatus.RECEIVED,
  receivedAt = new Date()
}) {
  if (!statuses.has(status)) throw new TypeError("inventory status is invalid");
  const now = timestamp(receivedAt, "receivedAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    pcxItemId: optionalString(pcxItemId, "pcxItemId"),
    productModelId: requiredString(productModelId, "productModelId"),
    acquisitionId: optionalString(acquisitionId, "acquisitionId"),
    status,
    receivedAt: now,
    createdAt: now,
    updatedAt: now
  });
}

export function createSerialIdentifier({
  id,
  inventoryItemId,
  identifierType,
  value,
  isPrimary = false,
  createdAt = new Date()
}) {
  if (!identifierTypes.has(identifierType)) throw new TypeError("serial identifier type is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    identifierType,
    valueNormalized: normalizeSerialIdentifier(value),
    valueDisplay: requiredString(value, "value"),
    isPrimary: isPrimary === true,
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function assertPrimarySerialIdentifier(identifiers) {
  if (!Array.isArray(identifiers) || identifiers.length === 0) throw new TypeError("at least one serial identifier is required");
  if (!identifiers.some((identifier) => identifier?.isPrimary === true)) throw new TypeError("one identifier must be primary");
  const seen = new Set();
  for (const identifier of identifiers) {
    const key = `${identifier.identifierType}:${identifier.valueNormalized}`;
    if (seen.has(key)) throw new TypeError("duplicate serial identifier in submission");
    seen.add(key);
  }
  return identifiers;
}
