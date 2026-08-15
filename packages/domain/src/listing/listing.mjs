export const ListingStatus = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
  RESERVED: "RESERVED",
  SOLD: "SOLD",
  ARCHIVED: "ARCHIVED"
});

const statuses = new Set(Object.values(ListingStatus));

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

// Listing is created as DRAFT; status is server-owned. Publish requires a
// populated public slug and transitions only from DRAFT/PAUSED.
export function createListing({
  id,
  inventoryItemId,
  publicSlug = null,
  warrantyPolicyId = null,
  createdAt = new Date()
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    publicSlug: optionalString(publicSlug, "publicSlug"),
    status: ListingStatus.DRAFT,
    warrantyPolicyId: optionalString(warrantyPolicyId, "warrantyPolicyId"),
    publishedAt: null,
    createdAt: timestamp(createdAt, "createdAt")
  });
}

export function publishListing(listing, { publishedAt = new Date(), publicSlug } = {}) {
  if (!listing || typeof listing !== "object") throw new TypeError("listing is required");
  if (listing.status !== ListingStatus.DRAFT && listing.status !== ListingStatus.PAUSED) throw new TypeError("only a DRAFT or PAUSED listing can be published");
  const slug = publicSlug == null ? listing.publicSlug : publicSlug;
  if (!slug || typeof slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new TypeError("public slug must be canonical");
  return Object.freeze({
    ...listing,
    publicSlug: slug,
    status: ListingStatus.PUBLISHED,
    publishedAt: timestamp(publishedAt, "publishedAt")
  });
}

export function createListingPrice({
  id,
  listingId,
  price,
  validFrom = new Date(),
  validTo = null,
  reason = null,
  setByUser
}) {
  if (validTo != null && new Date(validTo).getTime() <= new Date(validFrom).getTime()) throw new TypeError("validTo must be after validFrom");
  return Object.freeze({
    id: requiredString(id, "id"),
    listingId: requiredString(listingId, "listingId"),
    price: money(price, "price"),
    validFrom: timestamp(validFrom, "validFrom"),
    validTo: validTo == null ? null : timestamp(validTo, "validTo"),
    reason: optionalString(reason, "reason"),
    setByUser: requiredString(setByUser, "setByUser")
  });
}

// Public passport exposes only approved disclosure fields. Full serials,
// acquisition cost, private evidence, and internal technician data are never
// included; serials stay masked or absent here.
export function createPublicPassport({
  pcxItemId,
  modelId,
  name,
  categoryId,
  brandId,
  grade = null,
  healthScore = null,
  price = null,
  status,
  publishedAt,
  specifications = [],
  verificationSummary = null
}) {
  return Object.freeze({
    pcxItemId: requiredString(pcxItemId, "pcxItemId"),
    modelId: requiredString(modelId, "modelId"),
    name: requiredString(name, "name"),
    categoryId: requiredString(categoryId, "categoryId"),
    brandId: requiredString(brandId, "brandId"),
    grade,
    healthScore: healthScore == null ? null : (Number.isFinite(healthScore) ? healthScore : null),
    price: price == null ? null : money(price, "price"),
    status: requiredString(status, "status"),
    publishedAt: publishedAt == null ? null : timestamp(publishedAt, "publishedAt"),
    specifications: Object.freeze([...(specifications ?? [])]),
    verificationSummary: verificationSummary == null ? null : requiredString(verificationSummary, "verificationSummary")
  });
}
