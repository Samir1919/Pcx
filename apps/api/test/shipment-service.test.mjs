import assert from "node:assert/strict";
import test from "node:test";
import { createShipmentService } from "../src/modules/logistics/shipment-service.mjs";
import { ShipmentStatus } from "../../../packages/domain/src/index.mjs";

const address = { line1: "1 Main St", city: "Dhaka", country: "BD" };

function fixture(overrides = {}) {
  const calls = { creates: [], ships: [], delivers: [], returns: [], events: [], courierCalls: [] };
  const repository = {
    async create(record) { calls.creates.push(record); return record; },
    async markShipped(id, trackingId, now) { calls.ships.push({ id, trackingId, now }); return { status: "shipped", record: { id, status: ShipmentStatus.SHIPPED, trackingId } }; },
    async markDelivered(id, now) { calls.delivers.push({ id, now }); return { status: "delivered", record: { id, status: ShipmentStatus.DELIVERED } }; },
    async markReturned(id, now) { calls.returns.push({ id, now }); return { status: "returned", record: { id, status: ShipmentStatus.RETURNED } }; },
    async recordEvent(event) { calls.events.push(event); return { id: event.id }; },
    ...overrides.repository
  };
  const courier = {
    async createShipment({ reference, address: addr }) { calls.courierCalls.push({ reference, address: addr }); return { trackingId: `sandbox-trk-${reference}`, status: "CREATED" }; },
    ...overrides.courier
  };
  const service = createShipmentService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    courier,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    webhookSecret: "test-secret"
  });
  return { service, calls };
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


