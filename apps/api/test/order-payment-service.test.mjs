import assert from "node:assert/strict";
import test from "node:test";
import { createOrderPaymentService } from "../src/modules/commerce/order-payment-service.mjs";
import { PaymentDirection, PaymentMethod, PaymentStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { orders: [], items: [], payments: [], confirms: [] };
  const repository = {
    async createOrderWithItems(record, items) {
      calls.orders.push(record);
      calls.items.push(...items);
      return { order: { ...record, orderNo: "ORD-000001" }, items: items.map((item) => ({ id: item.id })) };
    },
    async createPayment(record) { calls.payments.push(record); return record; },
    async confirmPayment(txn, userId, now) { calls.confirms.push({ txn, userId, now }); return { status: "confirmed", record: { id: "p1", providerTransactionId: txn, status: PaymentStatus.CONFIRMED } }; },
    async findPaymentByProviderTransactionId(txn) { return txn === "bkash-pay-1" ? { id: "p1", providerTransactionId: txn, status: PaymentStatus.INITIATED } : null; },
    async findPaymentByOrderId() { return null; },
    async reconcilePayment(txn, now) { calls.reconciles = (calls.reconciles ?? []).concat([{ txn, now }]); return { status: "confirmed", record: { id: "p1", providerTransactionId: txn, status: PaymentStatus.CONFIRMED } }; },
    ...overrides.repository
  };
  const service = createOrderPaymentService({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    gateway: overrides.gateway,
    paymentProviderConfigService: overrides.paymentProviderConfigService,
    bkashGatewayFactory: overrides.bkashGatewayFactory
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
  assert.equal(result.shippingAmount, 60);
  assert.equal(result.taxAmount, 75);
  assert.equal(result.totalAmount, 1635); // 1500 + 60 shipping + 75 VAT
  assert.equal(calls.items.length, 2);
  assert.equal(calls.orders[0].userId, "customer-1");

  await assert.rejects(service.createOrder("access", { items: [] }), (error) => error.code === "invalid_input");

  const inactive = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "SUSPENDED", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(inactive.service.createOrder("access", { items: [{ inventoryItemId: "i", productModelId: "m", pcxItemId: "p", productName: "n", unitPrice: 1 }] }), (error) => error.code === "forbidden");
});

test("payment create derives provider txn id from the gateway and confirm enforces state", async () => {
  const { service, calls } = fixture();
  const payment = await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 1500 });
  assert.equal(payment.status, PaymentStatus.INITIATED);
  // The provider transaction id is server-authoritative: derived from the
  // sandbox gateway from the deterministic order+amount reference.
  assert.equal(calls.payments[0].providerTransactionId, "sandbox-pay-payment-o1-1500");
  assert.equal(calls.payments[0].provider, "SANDBOX");

  const conflict = fixture({ repository: { async createPayment() { const e = new Error("dup"); e.code = "23505"; throw e; } } });
  await assert.rejects(conflict.service.createPayment("access", { orderId: "o", direction: "INBOUND", method: PaymentMethod.BKASH, amount: 1 }), (error) => error.code === "conflict");

  const { service: confirmSvc } = fixture();
  const confirmed = await confirmSvc.confirmPayment("access", "sandbox-pay-id-1");
  assert.equal(confirmed.status, PaymentStatus.CONFIRMED);

  const invalidState = fixture({ repository: { async confirmPayment() { return { status: "not_confirmable" }; } } });
  await assert.rejects(invalidState.service.confirmPayment("access", "sandbox-pay-id-1"), (error) => error.code === "invalid_state");
});

test("reconcileBkashPayment executes the gateway and confirms server-authoritatively", async () => {
  const { service, calls } = fixture({
    gateway: {
      async charge() { return { providerTransactionId: "bkash-pay-1", status: "INITIATED" }; },
      async execute({ paymentId }) { return { status: "CONFIRMED", paymentId, trxID: "trx-1" }; }
    }
  });
  const record = await service.reconcileBkashPayment("bkash-pay-1");
  assert.equal(record.status, PaymentStatus.CONFIRMED);
  assert.equal(calls.reconciles.length, 1);
  assert.equal(calls.reconciles[0].txn, "bkash-pay-1");

  // Unknown payment fails closed.
  await assert.rejects(service.reconcileBkashPayment("unknown"), (error) => error.code === "invalid_state");

  // A non-CONFIRMED execute result fails closed (never marks the order paid).
  const failed = fixture({ gateway: { async charge() { return {}; }, async execute() { return { status: "FAILED" }; } } });
  await assert.rejects(failed.service.reconcileBkashPayment("bkash-pay-1"), (error) => error.code === "invalid_state");

  // A gateway without execute (sandbox) cannot reconcile a bKash redirect.
  const sandbox = fixture();
  await assert.rejects(sandbox.service.reconcileBkashPayment("bkash-pay-1"), (error) => error.code === "invalid_state");
});

test("order creation surfaces the double-sell guard as item_unavailable", async () => {
  const { service } = fixture({
    repository: {
      async createOrderWithItems() {
        const error = new Error("item is no longer available");
        error.code = "item_unavailable";
        throw error;
      }
    }
  });
  await assert.rejects(
    service.createOrder("access", { items: [{ inventoryItemId: "inv-1", productModelId: "m1", pcxItemId: "PCX-1", productName: "GPU", unitPrice: 1000 }] }),
    (error) => error.code === "item_unavailable"
  );
});

test("payment create rejects client-supplied provider and providerTransactionId (server-authoritative)", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, providerTransactionId: "client-forged", method: PaymentMethod.BKASH, amount: 1500 }),
    (error) => error.code === "invalid_input"
  );
});

test("payment create uses an injected gateway and defaults provider to SANDBOX", async () => {
  const charges = [];
  const gateway = { async charge({ amount, currency, reference }) { charges.push({ amount, currency, reference }); return { providerTransactionId: `gw-${reference}`, status: "CONFIRMED" }; } };
  const { service, calls } = fixture({ gateway });
  const payment = await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 });
  assert.equal(payment.status, PaymentStatus.INITIATED);
  assert.equal(calls.payments[0].providerTransactionId, "gw-payment-o1-500");
  assert.equal(calls.payments[0].provider, "SANDBOX");
  assert.deepEqual(charges, [{ amount: 500, currency: "BDT", reference: "payment-o1-500" }]);
});

test("payment create records the provider identity for active SANDBOX credentials and fails closed for REAL", async () => {
  // A bKash config must record provider "bkash" (who took the money), never the
  // credential mode. REAL mode is a hard stop and must never build a gateway.
  let builtCredentials = null;
  const bkashGatewayFactory = (credentials) => {
    builtCredentials = credentials;
    return { async charge({ reference }) { return { providerTransactionId: `http-${reference}`, status: "INITIATED" }; } };
  };
  const paymentProviderConfigService = {
    async getActiveCredentials(provider) {
      assert.equal(provider, "bkash");
      return { mode: "SANDBOX", credentials: { appKey: "k", appSecret: "s" } };
    }
  };
  const { service, calls } = fixture({ paymentProviderConfigService, bkashGatewayFactory });
  await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 });
  assert.equal(calls.payments[0].provider, "bkash");
  assert.equal(calls.payments[0].providerTransactionId, "http-payment-o1-500");
  assert.deepEqual(builtCredentials, { appKey: "k", appSecret: "s" });

  // REAL mode must fail closed (no live gateway is ever constructed).
  let built = false;
  const real = fixture({
    paymentProviderConfigService: { async getActiveCredentials() { return { mode: "REAL", credentials: { appKey: "k" } }; } },
    bkashGatewayFactory: () => { built = true; return { async charge() { return { providerTransactionId: "live", status: "CONFIRMED" }; } }; }
  });
  await assert.rejects(
    real.service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 }),
    (error) => error.code === "invalid_input"
  );
  assert.equal(built, false, "REAL mode must not construct a live gateway");
});

test("payment create falls back to the sandbox provider when no credentials are active", async () => {
  const paymentProviderConfigService = { async getActiveCredentials() { return null; } };
  const { service, calls } = fixture({ paymentProviderConfigService });
  await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 });
  assert.equal(calls.payments[0].provider, "SANDBOX");
});

test("payment create derives a deterministic idempotency reference from order and amount", async () => {
  const references = [];
  const gateway = {
    async charge({ amount, currency, reference }) { references.push(reference); return { providerTransactionId: `gw-${reference}`, status: "CONFIRMED" }; }
  };
  const { service, calls } = fixture({ gateway });
  await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 });
  await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.BKASH, amount: 500 });
  assert.deepEqual(references, ["payment-o1-500", "payment-o1-500"], "a retry must reuse the same charge reference, not a fresh random id");
  assert.equal(calls.payments[0].providerTransactionId, calls.payments[1].providerTransactionId);
});

test("COD payment records a deterministic server-derived provider id without any gateway charge", async () => {
  let chargeCalled = false;
  const gateway = { async charge() { chargeCalled = true; return { providerTransactionId: "should-not-happen" }; } };
  const { service, calls } = fixture({ gateway });
  const payment = await service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: PaymentMethod.COD, amount: 1500 });
  assert.equal(payment.status, PaymentStatus.INITIATED);
  assert.equal(calls.payments[0].provider, "COD");
  assert.equal(calls.payments[0].providerTransactionId, "cod-o1-1500");
  assert.equal(chargeCalled, false, "COD must never call the external gateway");
});

test("payment create rejects an unknown method (only BKASH and COD are supported)", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.createPayment("access", { orderId: "o1", direction: PaymentDirection.INBOUND, method: "CARD", amount: 1500 }),
    (error) => error.code === "invalid_input"
  );
});
