export const SellRequestStatus = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  REVIEWING: "REVIEWING"
});

export const FulfilmentPreference = Object.freeze({
  PICKUP: "PICKUP",
  DROP_OFF: "DROP_OFF",
  COURIER: "COURIER"
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
    status,
    submittedAt: null,
    createdAt: now,
    updatedAt: now
  });
}

export function submitSellRequest(record, { submittedAt = new Date() } = {}) {
  if (!record || typeof record !== "object") throw new TypeError("sell request is required");
  if (record.status !== SellRequestStatus.DRAFT) throw new TypeError("only a DRAFT sell request can be submitted");
  return Object.freeze({
    ...record,
    status: SellRequestStatus.SUBMITTED,
    submittedAt: timestamp(submittedAt, "submittedAt"),
    updatedAt: timestamp(submittedAt, "submittedAt")
  });
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
  if (!statuses.has(value)) throw new TypeError("sell request status is invalid");
  return value;
}
