import assert from "node:assert/strict";
import test from "node:test";
import { createSandboxCourier, createSandboxNotificationDispatcher, createSandboxPaymentGateway } from "../src/index.mjs";

test("sandbox notification dispatcher matches the injected dispatcher contract", async () => {
  const delivered = [];
  const dispatcher = createSandboxNotificationDispatcher({
    channel: "EMAIL",
    send: async ({ notification }) => { delivered.push(notification.id); return { delivered: true }; }
  });
  const outcome = await dispatcher.send({ id: "n1", channel: "EMAIL", notificationType: "ORDER_CONFIRMED", payloadSnapshot: { orderNo: "ORD-1" } });
  assert.equal(outcome.id, "n1");
  assert.equal(outcome.channel, "EMAIL");
  assert.equal(outcome.delivered, true);
  assert.deepEqual(delivered, ["n1"]);
});

test("sandbox notification dispatcher validates channel and rejects secrets", async () => {
  assert.throws(() => createSandboxNotificationDispatcher({ channel: "FAX" }), /not supported/);
  const dispatcher = createSandboxNotificationDispatcher({ channel: "SMS" });
  await assert.rejects(() => dispatcher.send({ id: "n1", payloadSnapshot: { token: "secret" } }), /secret/);
  await assert.rejects(() => dispatcher.send({}), /notification\.id/);
});

test("sandbox payment gateway is idempotent by reference and validates inputs", async () => {
  const calls = [];
  const gateway = createSandboxPaymentGateway({
    charge: async ({ reference }) => { calls.push(reference); return { providerTransactionId: `tx-${reference}`, status: "CONFIRMED" }; }
  });
  const first = await gateway.charge({ amount: 100, currency: "USD", reference: "order-1" });
  const second = await gateway.charge({ amount: 100, currency: "USD", reference: "order-1" });
  assert.equal(first.providerTransactionId, "tx-order-1");
  assert.equal(first.status, "CONFIRMED");
  assert.equal(second.providerTransactionId, first.providerTransactionId);
  assert.equal(calls.length, 1, "same reference must not be charged twice");
  await assert.rejects(() => gateway.charge({ amount: -5, currency: "USD", reference: "r" }), /amount/);
  await assert.rejects(() => gateway.charge({ amount: 10, currency: "XYZ", reference: "r" }), /currency/);
  await assert.rejects(() => gateway.charge({ amount: 10, currency: "USD" }), /reference/);
});

test("sandbox payment gateway dedupes concurrent charges for the same reference", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const gateway = createSandboxPaymentGateway({
    charge: async ({ reference }) => {
      calls += 1;
      await gate;
      return { providerTransactionId: `tx-${reference}`, status: "CONFIRMED" };
    }
  });
  const first = gateway.charge({ amount: 100, currency: "USD", reference: "race-1" });
  const second = gateway.charge({ amount: 100, currency: "USD", reference: "race-1" });
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1, "concurrent same-reference charges must share one in-flight charge");
  assert.equal(a.providerTransactionId, "tx-race-1");
  assert.equal(b.providerTransactionId, "tx-race-1");
});

test("sandbox payment gateway default returns a deterministic transaction id", async () => {
  const gateway = createSandboxPaymentGateway();
  const result = await gateway.charge({ amount: 50, currency: "BDT", reference: "acq-9" });
  assert.equal(result.providerTransactionId, "sandbox-pay-acq-9");
  assert.equal(result.status, "CONFIRMED");
});

test("sandbox courier creates a deterministic shipment and validates address", async () => {
  const courier = createSandboxCourier();
  const shipment = await courier.createShipment({ reference: "order-2", address: { line1: "1 Main St", city: "Dhaka", country: "BD" } });
  assert.equal(shipment.trackingId, "sandbox-trk-order-2");
  assert.equal(shipment.status, "CREATED");
  await assert.rejects(() => courier.createShipment({ reference: "order-2", address: { city: "Dhaka" } }), /address\.line1/);
  const invalid = createSandboxCourier({ createShipment: async () => ({ trackingId: "trk-x", status: "LOST" }) });
  await assert.rejects(() => invalid.createShipment({ reference: "order-2", address: { line1: "1 Main St", city: "Dhaka", country: "BD" } }), /courier status/);
});

test("sandbox courier delegates to an injected createShipment", async () => {
  const courier = createSandboxCourier({ createShipment: async () => ({ trackingId: "trk-abc", status: "PICKED_UP" }) });
  const shipment = await courier.createShipment({ reference: "order-3", address: { line1: "2 High St", city: "London", country: "GB" } });
  assert.equal(shipment.trackingId, "trk-abc");
  assert.equal(shipment.status, "PICKED_UP");
});

