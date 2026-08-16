import assert from "node:assert/strict";
import test from "node:test";
import { createShipment, createShipmentEvent, markDelivered, markReturned, markShipped, ShipmentStatus } from "../src/index.mjs";


test("shipment is DRAFT and transitions DRAFT→SHIPPED→DELIVERED", () => {
  const shipment = createShipment({ id: "s1", orderId: "o1", courier: "Pathao", packageType: "box", weight: 1.2, createdAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(shipment.status, ShipmentStatus.DRAFT);
  assert.equal(shipment.shippedAt, null);

  const shipped = markShipped(shipment, "TRK-123", { shippedAt: "2026-08-16T13:00:00.000Z" });
  assert.equal(shipped.status, ShipmentStatus.SHIPPED);
  assert.equal(shipped.trackingId, "TRK-123");
  assert.throws(() => markShipped(shipped, "TRK-456"), /DRAFT/);

  const delivered = markDelivered(shipped, { deliveredAt: "2026-08-16T15:00:00.000Z" });
  assert.equal(delivered.status, ShipmentStatus.DELIVERED);
  assert.throws(() => markDelivered(shipment), /SHIPPED/);
});

test("shipment can be returned from SHIPPED and records returnedAt", () => {
  const shipment = createShipment({ id: "s1", orderId: "o1", courier: "Pathao", packageType: "box", weight: 1.2, createdAt: "2026-08-16T12:00:00.000Z" });
  const shipped = markShipped(shipment, "TRK-123", { shippedAt: "2026-08-16T13:00:00.000Z" });
  const returned = markReturned(shipped, { returnedAt: "2026-08-16T16:00:00.000Z" });
  assert.equal(returned.status, ShipmentStatus.RETURNED);
  assert.equal(returned.returnedAt, "2026-08-16T16:00:00.000Z");
  assert.throws(() => markReturned(shipment), /SHIPPED/);
  assert.throws(() => markReturned(returned), /SHIPPED/);
});

test("shipment event validates status and negative amounts are rejected", () => {

  const event = createShipmentEvent({ id: "e1", shipmentId: "s1", status: "SHIPPED", providerStatusRaw: "picked", occurredAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(event.status, "SHIPPED");
  assert.throws(() => createShipmentEvent({ id: "e", shipmentId: "s", status: "BOGUS" }), /invalid/);
  assert.throws(() => createShipment({ id: "s", orderId: "o", courier: "c", packageType: "box", weight: -1 }), /non-negative/);
});
