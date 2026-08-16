export const ShipmentStatus = Object.freeze({
  DRAFT: "DRAFT",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED"
});

const statuses = new Set(Object.values(ShipmentStatus));

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

function optionalMoney(value, name) {
  if (value == null) return 0;
  return money(value, name);
}

export function createShipment({
  id,
  orderId,
  courier,
  trackingId = null,
  packageType,
  weight,
  codAmount = 0,
  shippingCharge = 0,
  createdAt = new Date()
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    orderId: requiredString(orderId, "orderId"),
    courier: requiredString(courier, "courier"),
    trackingId: optionalString(trackingId, "trackingId"),
    packageType: requiredString(packageType, "packageType"),
    weight: money(weight, "weight"),
    codAmount: optionalMoney(codAmount, "codAmount"),
    shippingCharge: optionalMoney(shippingCharge, "shippingCharge"),
    status: ShipmentStatus.DRAFT,
    createdAt: timestamp(createdAt, "createdAt"),
    shippedAt: null,
    deliveredAt: null
  });
}

export function markShipped(shipment, trackingId, { shippedAt = new Date() } = {}) {
  if (!shipment || typeof shipment !== "object") throw new TypeError("shipment is required");
  if (shipment.status !== ShipmentStatus.DRAFT) throw new TypeError("only a DRAFT shipment can be shipped");
  return Object.freeze({
    ...shipment,
    trackingId: requiredString(trackingId, "trackingId"),
    status: ShipmentStatus.SHIPPED,
    shippedAt: timestamp(shippedAt, "shippedAt")
  });
}

export function markDelivered(shipment, { deliveredAt = new Date() } = {}) {
  if (!shipment || typeof shipment !== "object") throw new TypeError("shipment is required");
  if (shipment.status !== ShipmentStatus.SHIPPED) throw new TypeError("only a SHIPPED shipment can be delivered");
  return Object.freeze({
    ...shipment,
    status: ShipmentStatus.DELIVERED,
    deliveredAt: timestamp(deliveredAt, "deliveredAt")
  });
}

export function createShipmentEvent({ id, shipmentId, status, providerStatusRaw = null, occurredAt = new Date() }) {
  if (!statuses.has(status)) throw new TypeError("shipment status is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    shipmentId: requiredString(shipmentId, "shipmentId"),
    status,
    providerStatusRaw: optionalString(providerStatusRaw, "providerStatusRaw"),
    occurredAt: timestamp(occurredAt, "occurredAt")
  });
}
