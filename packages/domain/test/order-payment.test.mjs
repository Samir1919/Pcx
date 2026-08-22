import assert from "node:assert/strict";
import test from "node:test";
import { confirmPayment, createOrder, createOrderItemSnapshot, createPayment, OrderStatus, PaymentDirection, PaymentMethod, PaymentStatus } from "../src/index.mjs";

test("order totals are server-computed and never negative", () => {
  const order = createOrder({ id: "o1", userId: "u1", subtotal: 1000, shippingAmount: 100, discountAmount: 50, placedAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(order.totalAmount, 1050);
  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.throws(() => createOrder({ id: "o", userId: "u", subtotal: 100, discountAmount: 500 }), /negative/);
  assert.throws(() => createOrder({ id: "o", userId: "u", subtotal: -1 }), /non-negative/);
});

test("order item snapshot preserves sold facts and rejects negative price", () => {
  const snapshot = createOrderItemSnapshot({ id: "oi1", orderId: "o1", inventoryItemId: "inv-1", productModelId: "m1", pcxItemId: "PCX-1", productName: "GPU", unitPrice: 1000, specs: ["8GB"] });
  assert.equal(snapshot.unitPrice, 1000);
  assert.deepEqual(snapshot.specs, ["8GB"]);
  assert.equal(snapshot.pcxItemId, "PCX-1");
  assert.throws(() => createOrderItemSnapshot({ id: "oi", orderId: "o", inventoryItemId: "i", productModelId: "m", pcxItemId: "p", productName: "n", unitPrice: -1 }), /non-negative/);
});

test("payment is idempotent by provider txn and confirms once", () => {
  const payment = createPayment({ id: "p1", orderId: "o1", direction: PaymentDirection.INBOUND, provider: "bkash", providerTransactionId: "txn-1", method: PaymentMethod.BKASH, amount: 1050, initiatedAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(payment.status, PaymentStatus.INITIATED);

  const confirmed = confirmPayment(payment, { confirmedAt: "2026-08-16T12:05:00.000Z" });
  assert.equal(confirmed.status, PaymentStatus.CONFIRMED);
  assert.equal(confirmed.confirmedAt, "2026-08-16T12:05:00.000Z");
  assert.throws(() => confirmPayment(confirmed), /INITIATED/);
  assert.throws(() => createPayment({ id: "p", direction: "SIDEWAYS", provider: "p", providerTransactionId: "x", method: PaymentMethod.COD, amount: 1 }), /direction/);
  assert.throws(() => createPayment({ id: "p", direction: PaymentDirection.INBOUND, provider: "p", providerTransactionId: "x", method: "CARD", amount: 1 }), /method/);
});
