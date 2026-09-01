import assert from "node:assert/strict";
import test from "node:test";
import { createShipmentService } from "../src/modules/logistics/shipment-service.mjs";
import { ShipmentStatus } from "@pcx/domain";

const address = { line1: "1 Main St", city: "Dhaka", country: "BD" };

function fixture(overrides = {}) {
  const calls = { creates: [], ships: [], delivers: [], returns: [], events: [], courierCalls: [], enqueued: [], applied: [], failed: [], pending: [] };
  const repository = {
    async create(record) { calls.creates.push(record); return record; },
    async markShipped(id, trackingId, now) { calls.ships.push({ id, trackingId, now }); return { status: "shipped", record: { id, orderId: "o1", status: ShipmentStatus.SHIPPED, trackingId } }; },
    async markDelivered(id, now) { calls.delivers.push({ id, now }); return { status: "delivered", record: { id, orderId: "o1", status: ShipmentStatus.DELIVERED } }; },
    async markReturned(id, now) { calls.returns.push({ id, now }); return { status: "returned", record: { id, orderId: "o1", status: ShipmentStatus.RETURNED } }; },
    async recordEvent(event) { calls.events.push(event); return { id: event.id }; },
    async list() { return []; },
    async enqueueWebhookEvent(event) { calls.enqueued.push(event); return { ...event, status: "PENDING", retryCount: 0 }; },
    async listPendingWebhookEvents(limit) { return calls.pending.slice(0, limit); },
    async markWebhookApplied(id, now) { calls.applied.push({ id, now }); return { id, status: "APPLIED" }; },
    // Mirrors the real repository branching: a failure with a still-scheduled
    // retry stays PENDING; only an exhausted budget flips to FAILED.
    async markWebhookFailed(id, retryCount, nextAttemptAt) { calls.failed.push({ id, retryCount, nextAttemptAt }); return { id, status: nextAttemptAt == null ? "FAILED" : "PENDING", retryCount }; },
    ...overrides.repository
  };

  const courier = {
    async createShipment({ reference, address: addr }) { calls.courierCalls.push({ reference, address: addr }); return { trackingId: `sandbox-trk-${reference}`, status: "CREATED" }; },
    ...overrides.courier
  };
  const emitted = [];
  const notificationEmitter = {
    async emit(input) { emitted.push(input); return { status: "pending" }; },
    ...overrides.notificationEmitter
  };
  const service = createShipmentService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    courier,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    webhookSecret: "test-secret",
    notificationEmitter,
    orderUserResolver: overrides.orderUserResolver ?? (async ({ orderId }) => `user-${orderId}`)
  });
  return { service, calls, emitted };
}


test("shipment create requires inventory/system permission", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", { orderId: "o1", courier: "Pathao", packageType: "box", weight: 1.2 });
  assert.equal(result.status, ShipmentStatus.DRAFT);
  assert.equal(calls.creates.length, 1);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.create("access", { orderId: "o", courier: "c", packageType: "box", weight: 1 }), (error) => error.code === "forbidden");
});

test("shipment ship derives tracking id from the courier and records the provider status", async () => {
  const { service, calls } = fixture();
  const shipped = await service.ship("access", "s1", address);
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.courierCalls.length, 1);
  assert.equal(calls.courierCalls[0].reference, "s1");
  assert.equal(calls.courierCalls[0].address, address);
  assert.equal(calls.ships[0].trackingId, "sandbox-trk-s1");
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].providerStatusRaw, "CREATED");
});

test("shipment ship ignores a client-supplied tracking id and derives it from the courier", async () => {
  const { service, calls } = fixture();
  const shipped = await service.ship("access", "s1", { ...address, trackingId: "FORGED" });
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.ships[0].trackingId, "sandbox-trk-s1");
  assert.notEqual(calls.ships[0].trackingId, "FORGED");
});


test("shipment ship supports an injected custom courier", async () => {
  const { service, calls } = fixture({
    courier: { async createShipment({ reference }) { return { trackingId: `custom-${reference}`, status: "PICKED_UP" }; } }
  });
  const shipped = await service.ship("access", "s1", address);
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.ships[0].trackingId, "custom-s1");
  assert.equal(calls.events[0].providerStatusRaw, "PICKED_UP");
});

test("shipment ship maps a courier failure to invalid_input", async () => {
  const { service } = fixture({ courier: { async createShipment() { throw new Error("courier down"); } } });
  await assert.rejects(service.ship("access", "s1", address), (error) => error.code === "invalid_input");
});

test("shipment ship and deliver enforce state transitions and record events", async () => {
  const { service, calls } = fixture();
  const shipped = await service.ship("access", "s1", address);
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.events.length, 1);

  const delivered = await service.deliver("access", "s1");
  assert.equal(delivered.status, ShipmentStatus.DELIVERED);
  assert.equal(calls.events.length, 2);

  const notShippable = fixture({ repository: { async markShipped() { return { status: "not_shippable" }; } } });
  await assert.rejects(notShippable.service.ship("access", "s1", address), (error) => error.code === "invalid_state");
});

test("webhook rejects a missing or bad signature", async () => {
  const { service } = fixture();
  await assert.rejects(service.handleWebhook({ signature: undefined, shipmentId: "s1", providerStatus: "DELIVERED" }), (error) => error.code === "unauthorized");
  await assert.rejects(service.handleWebhook({ signature: "wrong", shipmentId: "s1", providerStatus: "DELIVERED" }), (error) => error.code === "unauthorized");
});

test("webhook maps DELIVERED to markDelivered and records the provider status", async () => {
  const { service, calls } = fixture();
  const result = await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "DELIVERED" });
  assert.equal(result.status, "applied");
  assert.equal(calls.delivers.length, 1);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].status, "DELIVERED");
  assert.equal(calls.events[0].providerStatusRaw, "DELIVERED");
});

test("webhook maps RETURNED to markReturned and records the provider status", async () => {
  const { service, calls } = fixture();
  const result = await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "RETURNED" });
  assert.equal(result.status, "applied");
  assert.equal(calls.returns.length, 1);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].status, "RETURNED");
  assert.equal(calls.events[0].providerStatusRaw, "RETURNED");
});

test("webhook is idempotent for an already-final state", async () => {
  const { service, calls } = fixture({ repository: { async markDelivered() { return { status: "not_deliverable" }; } } });
  const result = await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "DELIVERED" });
  assert.equal(result.status, "noop");
  assert.equal(calls.events.length, 0);
});

test("webhook records an informational provider status without a state change", async () => {
  const { service, calls } = fixture();
  const result = await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "IN_TRANSIT" });
  assert.equal(result.status, "recorded");
  assert.equal(calls.delivers.length, 0);
  assert.equal(calls.returns.length, 0);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].providerStatusRaw, "IN_TRANSIT");
});

test("webhook durably enqueues every event to the outbox before application", async () => {
  const { service, calls } = fixture();
  await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "DELIVERED" });
  assert.equal(calls.enqueued.length, 1);
  assert.equal(calls.enqueued[0].shipmentId, "s1");
  assert.equal(calls.enqueued[0].providerStatus, "DELIVERED");
  assert.equal(calls.applied.length, 1);
  assert.equal(calls.applied[0].id, calls.enqueued[0].id);
});

test("webhook marks the outbox event applied for informational and noop statuses", async () => {
  const { service, calls } = fixture();
  await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "IN_TRANSIT" });
  assert.equal(calls.enqueued.length, 1);
  assert.equal(calls.applied.length, 1);
  assert.equal(calls.applied[0].id, calls.enqueued[0].id);

  const noop = fixture({ repository: { async markDelivered() { return { status: "not_deliverable" }; } } });
  await noop.service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "DELIVERED" });
  assert.equal(noop.calls.enqueued.length, 1);
  assert.equal(noop.calls.applied.length, 1);
});

test("dispatchDueWebhookEvents applies pending terminal events and marks them applied", async () => {
  const { service, calls } = fixture();
  calls.pending.push({ id: "evt-1", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 });
  const results = await service.dispatchDueWebhookEvents();
  assert.deepEqual(results, [{ id: "evt-1", status: "APPLIED" }]);
  assert.equal(calls.delivers.length, 1);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].status, "DELIVERED");
  assert.equal(calls.applied.length, 1);
  assert.equal(calls.applied[0].id, "evt-1");
});

test("dispatchDueWebhookEvents prefers the row-locking claim when provided", async () => {
  const claimed = [];
  const { service, calls } = fixture({
    repository: {
      async claimPendingWebhookEvents(limit) { claimed.push(limit); return [{ id: "evt-claim", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 }]; }
    }
  });
  const results = await service.dispatchDueWebhookEvents({ limit: 7 });
  assert.deepEqual(results, [{ id: "evt-claim", status: "APPLIED" }]);
  assert.deepEqual(claimed, [7]);
  assert.equal(calls.delivers.length, 1);
});

test("dispatchDueWebhookEvents records informational pending events without a state change", async () => {
  const { service, calls } = fixture();
  calls.pending.push({ id: "evt-2", shipmentId: "s1", providerStatus: "IN_TRANSIT", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 });
  const results = await service.dispatchDueWebhookEvents();
  assert.deepEqual(results, [{ id: "evt-2", status: "APPLIED" }]);
  assert.equal(calls.delivers.length, 0);
  assert.equal(calls.returns.length, 0);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].providerStatusRaw, "IN_TRANSIT");
});

test("dispatchDueWebhookEvents is idempotent for an already-final shipment", async () => {
  const { service, calls } = fixture({ repository: { async markDelivered() { return { status: "not_deliverable" }; } } });
  calls.pending.push({ id: "evt-3", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 });
  const results = await service.dispatchDueWebhookEvents();
  assert.deepEqual(results, [{ id: "evt-3", status: "APPLIED" }]);
  assert.equal(calls.events.length, 0);
  assert.equal(calls.applied.length, 1);
});

test("dispatchDueWebhookEvents schedules a retry and keeps the event pending", async () => {
  const { service, calls } = fixture({ repository: { async markDelivered() { throw new Error("db down"); } } });
  calls.pending.push({ id: "evt-4", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 });
  const results = await service.dispatchDueWebhookEvents();
  // A still-scheduled retry must remain PENDING, not be dropped as FAILED.
  assert.deepEqual(results, [{ id: "evt-4", status: "PENDING" }]);
  assert.equal(calls.failed.length, 1);
  assert.equal(calls.failed[0].id, "evt-4");
  assert.equal(calls.failed[0].retryCount, 1);
  assert.ok(calls.failed[0].nextAttemptAt);
});

test("dispatchDueWebhookEvents exhausts the retry budget and stops scheduling", async () => {
  const { service, calls } = fixture({ repository: { async markDelivered() { throw new Error("db down"); } } });
  calls.pending.push({ id: "evt-5", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 5 });
  const results = await service.dispatchDueWebhookEvents();
  assert.deepEqual(results, [{ id: "evt-5", status: "FAILED" }]);
  assert.equal(calls.failed.length, 1);
  assert.equal(calls.failed[0].retryCount, 6);
  assert.equal(calls.failed[0].nextAttemptAt, null);
});

test("ship emits SHIPMENT_SHIPPED to the resolved buyer", async () => {
  const { service, emitted } = fixture();
  await service.ship("access", "s1", address);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].notificationType, "SHIPMENT_SHIPPED");
  assert.equal(emitted[0].userId, "user-o1");
  assert.equal(emitted[0].referenceType, "shipment");
  assert.equal(emitted[0].referenceId, "s1");
});

test("deliver emits ORDER_DELIVERED to the resolved buyer", async () => {
  const { service, emitted } = fixture();
  await service.deliver("access", "s1");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].notificationType, "ORDER_DELIVERED");
  assert.equal(emitted[0].userId, "user-o1");
  assert.equal(emitted[0].referenceId, "s1");
});

test("return marks a SHIPPED shipment RETURNED and records the event", async () => {
  const { service, calls } = fixture();
  const returned = await service.return("access", "s1");
  assert.equal(returned.status, ShipmentStatus.RETURNED);
  assert.equal(calls.returns.length, 1);
  assert.equal(calls.returns[0].id, "s1");
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].status, "RETURNED");
});

test("delivery webhook emits ORDER_DELIVERED only for the delivered transition", async () => {
  const { service, emitted } = fixture();
  await service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "DELIVERED" });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].notificationType, "ORDER_DELIVERED");

  const returned = fixture();
  await returned.service.handleWebhook({ signature: "test-secret", shipmentId: "s1", providerStatus: "RETURNED" });
  assert.equal(returned.emitted.length, 0);
});

test("dispatch due webhook emits ORDER_DELIVERED after applying a delivered event", async () => {
  const { service, calls, emitted } = fixture();
  calls.pending.push({ id: "evt-1", shipmentId: "s1", providerStatus: "DELIVERED", occurredAt: "2026-08-16T12:00:00.000Z", retryCount: 0 });
  await service.dispatchDueWebhookEvents();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].notificationType, "ORDER_DELIVERED");
  assert.equal(emitted[0].userId, "user-o1");
});

test("notification emit failure never fails the shipment transition", async () => {
  const bombingEmitter = { async emit() { throw new Error("delivery down"); } };
  const { service, calls } = fixture({ notificationEmitter: bombingEmitter });
  const shipped = await service.ship("access", "s1", address);
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.events.length, 1);
});

test("missing order user resolver skips the emit without failing the transition", async () => {
  const { service, emitted } = fixture({ orderUserResolver: async () => null });
  const shipped = await service.ship("access", "s1", address);
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(emitted.length, 0);
});



