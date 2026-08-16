export const WarrantyStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  VOID: "VOID"
});

export const ClaimStatus = Object.freeze({
  REQUESTED: "REQUESTED",
  IN_REVIEW: "IN_REVIEW",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
});

export const ResolutionType = Object.freeze({
  REPAIR: "REPAIR",
  REPLACE: "REPLACE",
  REFUND: "REFUND",
  REJECT: "REJECT"
});

const warrantyStatuses = new Set(Object.values(WarrantyStatus));
const claimStatuses = new Set(Object.values(ClaimStatus));
const resolutionTypes = new Set(Object.values(ResolutionType));

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

function money(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative amount`);
  return value;
}

export function createWarranty({
  id,
  orderItemId,
  inventoryItemId,
  policySnapshot,
  startsAt = new Date(),
  endsAt
}) {
  const start = timestamp(startsAt, "startsAt");
  const end = timestamp(endsAt, "endsAt");
  if (new Date(end).getTime() <= new Date(start).getTime()) throw new TypeError("endsAt must be after startsAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    orderItemId: requiredString(orderItemId, "orderItemId"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    policySnapshot: Object.freeze(JSON.parse(JSON.stringify(policySnapshot ?? {}))),
    status: WarrantyStatus.ACTIVE,
    startsAt: start,
    endsAt: end
  });
}

export function createClaim({
  id,
  warrantyId,
  orderItemId,
  reasonCode,
  symptoms = null,
  requestedAt = new Date()
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    warrantyId: requiredString(warrantyId, "warrantyId"),
    orderItemId: requiredString(orderItemId, "orderItemId"),
    status: ClaimStatus.REQUESTED,
    reasonCode: requiredString(reasonCode, "reasonCode"),
    symptoms: optionalString(symptoms, "symptoms"),
    requestedAt: timestamp(requestedAt, "requestedAt"),
    receivedAt: null,
    resolvedAt: null
  });
}

export function createClaimResolution({
  id,
  claimId,
  resolutionType,
  notes = null,
  costAmount = null,
  approvedBy,
  createdAt = new Date()
}) {
  if (!resolutionTypes.has(resolutionType)) throw new TypeError("resolution type is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    claimId: requiredString(claimId, "claimId"),
    resolutionType,
    notes: optionalString(notes, "notes"),
    costAmount: costAmount == null ? null : money(costAmount, "costAmount"),
    approvedBy: requiredString(approvedBy, "approvedBy"),
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export { claimStatuses as _claimStatuses, resolutionTypes as _resolutionTypes };
