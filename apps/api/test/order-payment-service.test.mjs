import assert from "node:assert/strict";
import test from "node:test";
import { createOrderPaymentService } from "../src/modules/commerce/order-payment-service.mjs";
import { PaymentDirection, PaymentStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { orders: [], items: [], payments: [], confirms: [] };
  const repository = {
    async createOrder(record) { calls.orders.push(record); return { ...record, orderNo: "ORD-000001" }; },
    async createOrderItem(snapshot) { calls.items.push(snapshot); return { id: snapshot.id }; },
    async createPayment(record) { calls.payments.push(record); return record; },
    async confirmPayment(txn, now) { calls.confirms.push({ txn, now }); return { status: "confirmed", record: { id: "p1", providerTransactionId: txn, status: PaymentStatus.CONFIRMED } }; },
    ...overrides.repository
  };
  const service = createOrderPaymentService({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

test("order creation is customer-gated and derives totals from server-owned unit prices", async () => {
  const { service, calls } = fixture();
  const result = await service.createOrder("access", {
    items: [
      { inventoryItemId: "inv-1", productModelId: "m1", pcxItemId: "PCX-1", productName: "GPU", unitPrice: 1000 },
      { inventoryItemId: "inv-2", productModelId: "m1", pcxItemId: "PCX-2", productName: "GPU", unitPrice: 500 }
    ]
  });
  assert.equal(result.subtotal, 1500);
  assert.equal(result.totalAmount, 1500);
  assert.equal(calls.items.length, 2);
  assert.equal(calls.orders[0].userId, "customer-1");

  await assert.rejects(service.createOrder("access", { items: [] }), (error) => error.code === "invalid_input");

  const inactive = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "SUSPENDED", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(inactive.service.createOrder("access", { items: [{ inventoryItemId: "i", productModelId: "m", pcxItemId: "p", productName: "n", unitPrice: 1 }] }), (error) => error.code === "forbidden");
});

test("payment create maps unique provider txn conflict to 409 and confirm enforces state", async () => {
  const { service } = fixture();
  const payment = await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, provider: "bkash", providerTransactionId: "txn-1", method: "mobile", amount: 1500 });
  assert.equal(payment.status, PaymentStatus.INITIATED);

  const conflict = fixture({ repository: { async createPayment() { const e = new Error("dup"); e.code = "23505"; throw e; } } });
  await assert.rejects(conflict.service.createPayment("access", { orderId: "o", direction: "INBOUND", provider: "p", providerTransactionId: "x", method: "m", amount: 1 }), (error) => error.code === "conflict");

  const { service: confirmSvc } = fixture();
  const confirmed = await confirmSvc.confirmPayment("access", "txn-1");
  assert.equal(confirmed.status, PaymentStatus.CONFIRMED);

  const invalidState = fixture({ repository: { async confirmPayment() { return { status: "not_confirmable" }; } } });
  await assert.rejects(invalidState.service.confirmPayment("access", "txn-1"), (error) => error.code === "invalid_state");
});
