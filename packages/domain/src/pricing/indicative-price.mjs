// Indicative price ranges for the public Sell-to-PCX quotation.
//
// An indicative price is an estimated market range, never a final offer. It is
// scoped to exactly one of { productModelId, categoryId }:
//   - a product-model price overrides any category default for that model;
//   - a category price is the fallback when no model price exists.
//
// Prices are server-owned and append-only: setting a new range for a target
// archives the previous active range rather than mutating it. The client never
// supplies price; only an authorized admin (PRICING_MANAGE) sets it at the
// service boundary.

export const IndicativePriceStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
});

const statuses = new Set(Object.values(IndicativePriceStatus));

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

function parseStatus(value, name = "status") {
  if (!statuses.has(value)) throw new TypeError(`${name} is invalid`);
  return value;
}

export function createIndicativePrice({
  id,
  productModelId = null,
  categoryId = null,
  lowValue,
  highValue,
  status = IndicativePriceStatus.ACTIVE,
  setBy,
  createdAt = new Date()
}) {
  const productModel = optionalString(productModelId, "productModelId");
  const category = optionalString(categoryId, "categoryId");
  if ((productModel == null) === (category == null)) throw new TypeError("indicative price must target exactly one of productModelId or categoryId");
  const low = money(lowValue, "lowValue");
  const high = money(highValue, "highValue");
  if (low > high) throw new TypeError("indicative price low must not exceed high");
  return Object.freeze({
    id: requiredString(id, "id"),
    productModelId: productModel,
    categoryId: category,
    lowValue: low,
    highValue: high,
    status: parseStatus(status),
    setBy: requiredString(setBy, "setBy"),
    createdAt: timestamp(createdAt, "createdAt"),
    archivedAt: null
  });
}

export function archiveIndicativePrice(record, { archivedAt = new Date() } = {}) {
  if (!record || typeof record !== "object") throw new TypeError("indicative price is required");
  if (record.status === IndicativePriceStatus.ARCHIVED) return record;
  if (record.status !== IndicativePriceStatus.ACTIVE) throw new TypeError("indicative price has an unknown status");
  return Object.freeze({
    ...record,
    status: IndicativePriceStatus.ARCHIVED,
    archivedAt: timestamp(archivedAt, "archivedAt")
  });
}

// Public projection: only the estimated range and an explicit final-offer
// disclaimer. No cost, audience, serial, or private evidence is ever included.
export function toPublicQuoteRange(record) {
  if (!record) return null;
  return Object.freeze({
    lowValue: Number(record.lowValue),
    highValue: Number(record.highValue),
    productModelId: record.productModelId ?? null,
    categoryId: record.categoryId ?? null,
    basis: "indicative-range",
    disclaimer: "Estimated market range, not a final offer. The final offer is determined only after physical inspection."
  });
}
