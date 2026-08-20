import { parseSellEntry, validateBuildComponents } from "./sell-entry.mjs";

// Canonical Sell-to-PCX request lifecycle (reconciled from BUSINESS_PRODUCT_REQUIREMENTS
// §12 and API_SPECIFICATION_STATE_MACHINES §16; see ADR 0011 and the §12 note).
export const SellRequestStatus = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  REVIEWING: "REVIEWING",
  INFO_REQUIRED: "INFO_REQUIRED",
  INSPECTION_REQUIRED: "INSPECTION_REQUIRED",
  INSPECTING: "INSPECTING",
  OFFERED: "OFFERED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  REJECTED_BY_SELLER: "REJECTED_BY_SELLER",
  EXPIRED: "EXPIRED",
  ACQUISITION_PENDING: "ACQUISITION_PENDING",
  PAID: "PAID",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED"
});

export const FulfilmentPreference = Object.freeze({
  PICKUP: "PICKUP",
  DROP_OFF: "DROP_OFF",
  COURIER: "COURIER"
});

// Server-owned transition graph. A request is advanced only along these edges;
// any other move is rejected as an invalid state transition. Cancellation is
// allowed only from pre-ACCEPTED review states; accept/pay/close are terminal
// progress edges driven by acquisition/payment events.
export const SellRequestTransitions = Object.freeze({
  DRAFT: Object.freeze(["SUBMITTED", "CANCELLED"]),
  SUBMITTED: Object.freeze(["REVIEWING", "CANCELLED"]),
  REVIEWING: Object.freeze(["INFO_REQUIRED", "INSPECTION_REQUIRED", "REJECTED", "CANCELLED"]),
  INFO_REQUIRED: Object.freeze(["REVIEWING"]),
  INSPECTION_REQUIRED: Object.freeze(["INSPECTING"]),
  INSPECTING: Object.freeze(["OFFERED", "REJECTED"]),
  OFFERED: Object.freeze(["ACCEPTED", "REJECTED_BY_SELLER", "EXPIRED"]),
  ACCEPTED: Object.freeze(["ACQUISITION_PENDING"]),
  ACQUISITION_PENDING: Object.freeze(["PAID"]),
  PAID: Object.freeze(["CLOSED"]),
  REJECTED: Object.freeze([]),
  REJECTED_BY_SELLER: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  CLOSED: Object.freeze([]),
  CANCELLED: Object.freeze([])
});

const fulfilments = new Set(Object.values(FulfilmentPreference));
const statuses = new Set(Object.values(SellRequestStatus));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function optionalEmail(value) {
  if (value == null || value === "") return null;
  const normalized = requiredString(value, "contactEmail").toLowerCase();
  if (!normalized.includes("@")) throw new TypeError("contactEmail must be a valid email");
  return normalized;
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function optionalBoolean(value, name) {
  if (value == null) return false;
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

function parseStatus(value, name = "status") {
  if (!statuses.has(value)) throw new TypeError(`${name} is invalid`);
  return value;
}

// Selected specifications are the seller's declaration only. Each entry is a
// plain JSON-safe object with a string key and a scalar value; the values are
// captured for the S04 "Variant/Specs" step and never set price/grade/health.
function optionalSelectedSpecs(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError("selectedSpecs must be an array");
  return Object.freeze(value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("selectedSpecs entries must be objects");
    const key = requiredString(entry.key, "entry.key");
    const val = entry.value;
    const valid = val == null || typeof val === "string" || typeof val === "boolean" || (typeof val === "number" && Number.isFinite(val));
    if (!valid) throw new TypeError("selectedSpecs values must be scalar");
    return Object.freeze({ key, value: val ?? null });
  }));
}

// A sell request is created only as a DRAFT. Status is server-owned; the client
// never supplies it. The owner is derived from the authenticated identity.
export function createSellRequest({
  id,
  userId,
  categoryId,
  productModelId = null,
  contactName,
  contactPhone,
  contactEmail = null,
  fulfilmentPreference,
  selectedSpecs = [],
  sellEntry = null,
  buildComponents = [],
  createdAt = new Date()
}) {
  const status = SellRequestStatus.DRAFT;
  if (!fulfilments.has(fulfilmentPreference)) throw new TypeError("fulfilmentPreference is invalid");
  const now = timestamp(createdAt, "createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    publicRequestNo: null,
    userId: requiredString(userId, "userId"),
    categoryId: requiredString(categoryId, "categoryId"),
    productModelId: optionalString(productModelId, "productModelId"),
    contactName: requiredString(contactName, "contactName"),
    contactPhone: requiredString(contactPhone, "contactPhone"),
    contactEmail: optionalEmail(contactEmail, "contactEmail"),
    fulfilmentPreference,
    selectedSpecs: optionalSelectedSpecs(selectedSpecs),
    sellEntry: parseSellEntry(sellEntry),
    buildComponents: validateBuildComponents(buildComponents),
    status,
    submittedAt: null,
    createdAt: now,
    updatedAt: now
  });
}

export function assertSellRequestTransition(from, to) {
  const current = parseStatus(from, "from");
  const target = parseStatus(to, "to");
  const allowed = SellRequestTransitions[current];
  if (!allowed || !allowed.includes(target)) throw new TypeError("sell request state transition is not allowed");
  return { from: current, to: target };
}

// Advance a sell request along the server-owned transition graph. submittedAt is
// stamped on the first departure from DRAFT into a non-CANCELLED state.
export function advanceSellRequest(record, to, { at, submittedAt } = {}) {
  if (!record || typeof record !== "object") throw new TypeError("sell request is required");
  const { from, to: target } = assertSellRequestTransition(record.status, to);
  const now = timestamp(at ?? submittedAt ?? new Date(), "at");
  const leavesDraft = from === SellRequestStatus.DRAFT && target !== SellRequestStatus.CANCELLED;
  return Object.freeze({
    ...record,
    status: target,
    submittedAt: leavesDraft ? now : record.submittedAt ?? null,
    updatedAt: now
  });
}

export function submitSellRequest(record, options = {}) {
  return advanceSellRequest(record, SellRequestStatus.SUBMITTED, options);
}

export function createSellerDeclaration({
  id,
  sellRequestId,
  ageEstimate = null,
  warrantyRemaining = null,
  repairDeclared = false,
  repairNotes = null,
  boxAvailable = false,
  invoiceAvailable = false,
  ownershipDeclared = false,
  createdAt = new Date()
}) {
  if (ownershipDeclared !== true) throw new TypeError("ownership declaration must be confirmed");
  return Object.freeze({
    id: requiredString(id, "id"),
    sellRequestId: requiredString(sellRequestId, "sellRequestId"),
    ageEstimate: optionalString(ageEstimate, "ageEstimate"),
    warrantyRemaining: optionalString(warrantyRemaining, "warrantyRemaining"),
    repairDeclared: optionalBoolean(repairDeclared, "repairDeclared"),
    repairNotes: optionalString(repairNotes, "repairNotes"),
    boxAvailable: optionalBoolean(boxAvailable, "boxAvailable"),
    invoiceAvailable: optionalBoolean(invoiceAvailable, "invoiceAvailable"),
    ownershipDeclared: true,
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function parseSellRequestStatus(value) {
  return parseStatus(value);
}
