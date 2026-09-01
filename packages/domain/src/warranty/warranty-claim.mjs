export const WarrantyStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  VOID: "VOID"
});

export const WarrantyPolicyStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
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
const policyStatuses = new Set(Object.values(WarrantyPolicyStatus));
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
    resolvedAt: null,
    inspectionId: null
  });
}

// Link a claim to the inspection of the returned item, moving it REQUESTED →
// IN_REVIEW so the resolution is grounded in a real inspection.
export function linkClaimInspection(claim, inspectionId) {
  if (!claim || typeof claim !== "object") throw new TypeError("claim is required");
  if (claim.status !== ClaimStatus.REQUESTED) throw new TypeError("only a REQUESTED claim can be inspected");
  return Object.freeze({
    ...claim,
    inspectionId: requiredString(inspectionId, "inspectionId"),
    status: ClaimStatus.IN_REVIEW
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

// A warranty policy is a server-authored, reusable coverage template. Warranties
// reference a policy and snapshot its terms at issuance so the sold coverage
// facts are preserved even if the policy is later edited or archived.
export function createWarrantyPolicy({
  id,
  name,
  durationDays,
  coverageSummary,
  terms = null,
  status = WarrantyPolicyStatus.ACTIVE,
  createdAt = new Date()
}) {
  const duration = Number(durationDays);
  if (!Number.isInteger(duration) || duration <= 0) throw new TypeError("durationDays must be a positive integer");
  if (!policyStatuses.has(status)) throw new TypeError("warranty policy status is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    name: requiredString(name, "name"),
    durationDays: duration,
    coverageSummary: requiredString(coverageSummary, "coverageSummary"),
    terms: optionalString(terms, "terms"),
    status,
    createdAt: timestamp(createdAt, "createdAt"),
    archivedAt: null
  });
}

export function archiveWarrantyPolicy(policy, { archivedAt = new Date() } = {}) {
  if (!policy || typeof policy !== "object") throw new TypeError("warranty policy is required");
  if (policy.status === WarrantyPolicyStatus.ARCHIVED) return policy;
  if (policy.status !== WarrantyPolicyStatus.ACTIVE) throw new TypeError("warranty policy has an unknown status");
  return Object.freeze({
    ...policy,
    status: WarrantyPolicyStatus.ARCHIVED,
    archivedAt: timestamp(archivedAt, "archivedAt")
  });
}

// Snapshot of an authored policy's coverage facts, embedded into a warranty so
// the sold terms are immutable.
export function toWarrantyPolicySnapshot(policy) {
  if (!policy || typeof policy !== "object") return null;
  return Object.freeze({
    policyId: policy.id,
    name: policy.name,
    durationDays: policy.durationDays,
    coverageSummary: policy.coverageSummary,
    terms: policy.terms
  });
}

export { claimStatuses as _claimStatuses, resolutionTypes as _resolutionTypes };
