export const ReservationStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  CONVERTED: "CONVERTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
});

const statuses = new Set(Object.values(ReservationStatus));

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

// A reservation locks a physical item for a bounded window. It is created ACTIVE
// and is the core double-sell guard: at most one ACTIVE reservation per item.
export function createReservation({
  id,
  inventoryItemId,
  cartId = null,
  reservedByUserId,
  reservedUntil,
  createdAt = new Date()
}) {
  const reserved = timestamp(reservedUntil, "reservedUntil");
  const created = timestamp(createdAt, "createdAt");
  if (new Date(reserved).getTime() <= new Date(created).getTime()) throw new TypeError("reservedUntil must be after createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    cartId: optionalString(cartId, "cartId"),
    reservedByUserId: requiredString(reservedByUserId, "reservedByUserId"),
    status: ReservationStatus.ACTIVE,
    reservedUntil: reserved,
    createdAt: created
  });
}

export function convertReservation(reservation, { convertedAt = new Date() } = {}) {
  if (!reservation || typeof reservation !== "object") throw new TypeError("reservation is required");
  if (reservation.status !== ReservationStatus.ACTIVE) throw new TypeError("only an ACTIVE reservation can be converted");
  if (new Date(reservation.reservedUntil).getTime() <= new Date(convertedAt).getTime()) throw new TypeError("reservation has expired");
  return Object.freeze({
    ...reservation,
    status: ReservationStatus.CONVERTED,
    convertedAt: timestamp(convertedAt, "convertedAt")
  });
}

export function isExpiredReservation(reservation, now = new Date()) {
  return reservation?.status === ReservationStatus.ACTIVE && new Date(reservation.reservedUntil).getTime() <= new Date(now).getTime();
}
