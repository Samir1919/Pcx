import assert from "node:assert/strict";
import test from "node:test";
import { createShipmentService } from "../src/modules/logistics/shipment-service.mjs";
import { ShipmentStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { creates: [], ships: [], delivers: [], events: [] };
  const repository = {
    async create(record) { calls.creates.push(record); return record; },
    async markShipped(id, trackingId, now) { calls.ships.push({ id, trackingId, now }); return { status: "shipped", record: { id, status: ShipmentStatus.SHIPPED, trackingId } }; },
    async markDelivered(id, now) { calls.delivers.push({ id, now }); return { status: "delivered", record: { id, status: ShipmentStatus.DELIVERED } }; },
    async recordEvent(event) { calls.events.push(event); return { id: event.id }; },
    ...overrides.repository
  };
  const service = createShipmentService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
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

test("shipment ship and deliver enforce state transitions and record events", async () => {
  const { service, calls } = fixture();
  const shipped = await service.ship("access", "s1", "TRK-123");
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(calls.events.length, 1);

  const delivered = await service.deliver("access", "s1");
  assert.equal(delivered.status, ShipmentStatus.DELIVERED);
  assert.equal(calls.events.length, 2);

  const notShippable = fixture({ repository: { async markShipped() { return { status: "not_shippable" }; } } });
  await assert.rejects(notShippable.service.ship("access", "s1", "TRK"), (error) => error.code === "invalid_state");
});
