export const OrderStatus = Object.freeze({
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  PACKING: "PACKING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
});

export const PaymentDirection = Object.freeze({
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND"
});

export const PaymentStatus = Object.freeze({
  INITIATED: "INITIATED",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED"
});

// Cash on Delivery has no external provider charge; its provider transaction id
// is still server-derived (deterministic per order+amount) for idempotency.
export const PaymentMethod = Object.freeze({
  BKASH: "BKASH",
  COD: "COD"
});

const orderStatuses = new Set(Object.values(OrderStatus));
const directions = new Set(Object.values(PaymentDirection));
const paymentStatuses = new Set(Object.values(PaymentStatus));
const paymentMethods = new Set(Object.values(PaymentMethod));

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

// Order totals are server-computed: the client never authors price/totals.
// Shipping and discount are non-negative; total = subtotal + shipping + tax - discount.
export function createOrder({
  id,
  userId,
  subtotal,
  shippingAmount = 0,
  taxAmount = 0,
  discountAmount = 0,
  currency = "BDT",
  placedAt = new Date()
}) {
  const sub = money(subtotal, "subtotal");
  const ship = optionalMoney(shippingAmount, "shippingAmount");
  const tax = optionalMoney(taxAmount, "taxAmount");
  const disc = optionalMoney(discountAmount, "discountAmount");
  const total = sub + ship + tax - disc;
  if (total < 0) throw new TypeError("order total cannot be negative");
  return Object.freeze({
    id: requiredString(id, "id"),
    orderNo: null,
    userId: requiredString(userId, "userId"),
    status: OrderStatus.PENDING_PAYMENT,
    currency: requiredString(currency, "currency"),
    subtotal: sub,
    shippingAmount: ship,
    taxAmount: tax,
    discountAmount: disc,
    totalAmount: total,
    placedAt: timestamp(placedAt, "placedAt")
  });
}

// Server-owned shipping/tax allocation, derived from the subtotal — never client-
// supplied. Shipping is a flat rate, free above a threshold; tax is a flat VAT
// percentage of the subtotal. The service wires this into createOrder so the
// totals are always computed by the server, not re-derived by the UI.
export function deriveOrderAllocation(subtotal, { shippingRate = 60, freeShippingThreshold = 5000, taxRate = 0.05 } = {}) {
  const sub = money(subtotal, "subtotal");
  const shippingAmount = sub >= freeShippingThreshold ? 0 : shippingRate;
  const taxAmount = Math.round(sub * taxRate * 100) / 100;
  return Object.freeze({ shippingAmount, taxAmount });
}

export function createOrderItemSnapshot({
  id,
  orderId,
  inventoryItemId,
  listingId = null,
  productModelId,
  pcxItemId,
  productName,
  grade = null,
  healthScore = null,
  unitPrice,
  specs = []
}) {
  return Object.freeze({
    id: requiredString(id, "id"),
    orderId: requiredString(orderId, "orderId"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    listingId: optionalString(listingId, "listingId"),
    productModelId: requiredString(productModelId, "productModelId"),
    pcxItemId: requiredString(pcxItemId, "pcxItemId"),
    productName: requiredString(productName, "productName"),
    grade,
    healthScore: healthScore == null ? null : (Number.isFinite(healthScore) ? healthScore : null),
    unitPrice: money(unitPrice, "unitPrice"),
    specs: Object.freeze([...(specs ?? [])])
  });
}

// Payment is idempotent through a unique provider transaction id. Status is
// server-owned; the client never supplies status or amount.
export function createPayment({
  id,
  orderId = null,
  direction,
  provider,
  providerTransactionId,
  method,
  amount,
  initiatedAt = new Date()
}) {
  if (!directions.has(direction)) throw new TypeError("payment direction is invalid");
  if (!paymentMethods.has(method)) throw new TypeError("payment method is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    orderId: optionalString(orderId, "orderId"),
    direction,
    provider: requiredString(provider, "provider"),
    providerTransactionId: requiredString(providerTransactionId, "providerTransactionId"),
    method: requiredString(method, "method"),
    amount: money(amount, "amount"),
    status: PaymentStatus.INITIATED,
    initiatedAt: timestamp(initiatedAt, "initiatedAt"),
    confirmedAt: null
  });
}

export function confirmPayment(payment, { confirmedAt = new Date() } = {}) {
  if (!payment || typeof payment !== "object") throw new TypeError("payment is required");
  if (payment.status !== PaymentStatus.INITIATED) throw new TypeError("only an INITIATED payment can be confirmed");
  return Object.freeze({
    ...payment,
    status: PaymentStatus.CONFIRMED,
    confirmedAt: timestamp(confirmedAt, "confirmedAt")
  });
}

export { orderStatuses, paymentStatuses, paymentMethods };
