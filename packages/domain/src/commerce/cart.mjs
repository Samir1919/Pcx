export const CartStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  CONVERTED: "CONVERTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
});

const statuses = new Set(Object.values(CartStatus));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function money(value, name) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative amount`);
  return value;
}

// A customer cart is server-owned. The client supplies only item context, never
// price, status, or totals.
export function createCart({ id, userId, createdAt = new Date() }) {
  const now = timestamp(createdAt, "createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    userId: requiredString(userId, "userId"),
    status: CartStatus.ACTIVE,
    createdAt: now,
    updatedAt: now
  });
}

export function createCartItem({ id, cartId, inventoryItemId, listingId = null, priceSnapshot = null, createdAt = new Date() }) {
  return Object.freeze({
    id: requiredString(id, "id"),
    cartId: requiredString(cartId, "cartId"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    listingId: listingId == null || listingId === "" ? null : requiredString(listingId, "listingId"),
    priceSnapshot: money(priceSnapshot, "priceSnapshot"),
    createdAt: timestamp(createdAt, "createdAt")
  });
}
