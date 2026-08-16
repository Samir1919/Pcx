export const ValuationType = Object.freeze({
  PRELIMINARY: "PRELIMINARY",
  POST_INSPECTION: "POST_INSPECTION",
  MANUAL: "MANUAL"
});

export const OfferStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  WITHDRAWN: "WITHDRAWN"
});

export const AcquisitionSourceType = Object.freeze({
  SELL_TO_PCX: "SELL_TO_PCX",
  DIRECT_PURCHASE: "DIRECT_PURCHASE",
  TRADE_IN: "TRADE_IN",
  CORPORATE: "CORPORATE",
  OTHER: "OTHER"
});

export const AcquisitionPaymentStatus = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID"
});

const valuationTypes = new Set(Object.values(ValuationType));
const offerStatuses = new Set(Object.values(OfferStatus));
const sourceTypes = new Set(Object.values(AcquisitionSourceType));
const paymentStatuses = new Set(Object.values(AcquisitionPaymentStatus));

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
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive amount`);
  return value;
}

function optionalMoney(value, name) {
  if (value == null) return null;
  return money(value, name);
}

function optionalTimestamp(value, name) {
  if (value == null) return null;
  return timestamp(value, name);
}

// A valuation is an estimate, never a final offer. It has an explicit low/high
// range and an optional recommended value, and it is immutable once created.
export function createValuation({
  id,
  sellRequestId,
  valuationType,
  lowValue = null,
  highValue = null,
  recommendedValue = null,
  inputsSnapshot = null,
  createdBy,
  createdAt = new Date()
}) {
  if (!valuationTypes.has(valuationType)) throw new TypeError("valuation type is invalid");
  if (lowValue != null && highValue != null && lowValue > highValue) throw new TypeError("valuation low must not exceed high");
  if (recommendedValue != null && ((lowValue != null && recommendedValue < lowValue) || (highValue != null && recommendedValue > highValue))) {
    throw new TypeError("recommended value must fall within the valuation range");
  }
  return Object.freeze({
    id: requiredString(id, "id"),
    sellRequestId: requiredString(sellRequestId, "sellRequestId"),
    valuationType,
    lowValue: optionalMoney(lowValue, "lowValue"),
    highValue: optionalMoney(highValue, "highValue"),
    recommendedValue: optionalMoney(recommendedValue, "recommendedValue"),
    inputsSnapshot: inputsSnapshot == null ? null : Object.freeze(JSON.parse(JSON.stringify(inputsSnapshot))),
    createdBy: requiredString(createdBy, "createdBy"),
    createdAt: timestamp(createdAt, "createdAt")
  });
}

// An offer is a final, server-owned figure created from a valuation. The client
// never supplies status or amount; acceptance is recorded server-side only.
export function createOffer({
  id,
  sellRequestId,
  valuationId,
  amount,
  createdBy,
  expiresAt,
  createdAt = new Date()
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    sellRequestId: requiredString(sellRequestId, "sellRequestId"),
    valuationId: requiredString(valuationId, "valuationId"),
    amount: money(amount, "amount"),
    status: OfferStatus.ACTIVE,
    createdBy: requiredString(createdBy, "createdBy"),
    expiresAt: timestamp(expiresAt, "expiresAt"),
    createdAt: timestamp(createdAt, "createdAt"),
    acceptedAt: null
  });
}

export function acceptOffer(offer, { acceptedAt = new Date() } = {}) {
  if (!offer || typeof offer !== "object") throw new TypeError("offer is required");
  if (offer.status !== OfferStatus.ACTIVE) throw new TypeError("only an ACTIVE offer can be accepted");
  if (new Date(offer.expiresAt).getTime() <= new Date(acceptedAt).getTime()) throw new TypeError("offer has expired");
  return Object.freeze({
    ...offer,
    status: OfferStatus.ACCEPTED,
    acceptedAt: timestamp(acceptedAt, "acceptedAt")
  });
}

// The acquisition immutable financial basis: agreedPrice is captured from the
// accepted offer and never editable. Payment state is server-owned.
export function createAcquisition({
  id,
  sellRequestId,
  acceptedOfferId,
  sellerUserId,
  sourceType = AcquisitionSourceType.SELL_TO_PCX,
  agreedPrice,
  paymentStatus = AcquisitionPaymentStatus.PENDING,
  ownershipConfirmedAt = null,
  acquiredAt = new Date(),
  idempotencyKey
}) {
  if (!sourceTypes.has(sourceType)) throw new TypeError("acquisition source type is invalid");
  if (!paymentStatuses.has(paymentStatus)) throw new TypeError("acquisition payment status is invalid");
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 128) throw new TypeError("idempotencyKey is required");
  const now = timestamp(acquiredAt, "acquiredAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    sellRequestId: requiredString(sellRequestId, "sellRequestId"),
    acceptedOfferId: requiredString(acceptedOfferId, "acceptedOfferId"),
    sellerUserId: requiredString(sellerUserId, "sellerUserId"),
    sourceType,
    agreedPrice: money(agreedPrice, "agreedPrice"),
    paymentStatus,
    ownershipConfirmedAt: optionalTimestamp(ownershipConfirmedAt, "ownershipConfirmedAt"),
    acquiredAt: now,
    idempotencyKey
  });
}

// Server-owned payment transition: only a PENDING acquisition can be marked
// PAID. The client never sets payment state; this is the single authoritative
// path to record that the seller has been paid.
export function markAcquisitionPaid(acquisition, { paidAt = new Date() } = {}) {
  if (!acquisition || typeof acquisition !== "object") throw new TypeError("acquisition is required");
  if (acquisition.paymentStatus !== AcquisitionPaymentStatus.PENDING) throw new TypeError("only a PENDING acquisition can be marked PAID");
  return Object.freeze({
    ...acquisition,
    paymentStatus: AcquisitionPaymentStatus.PAID,
    paidAt: timestamp(paidAt, "paidAt")
  });
}

