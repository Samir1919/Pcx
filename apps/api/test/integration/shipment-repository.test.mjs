import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresShipmentRepository } from "../../src/modules/logistics/postgres-shipment-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("shipment repository persists draft, marks shipped/delivered, and records events", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresShipmentRepository({ pool });
  const customer = "9f000000-0000-4000-8000-000000000001";
  const orderId = "9f000000-0000-4000-8000-000000000002";
  const shipmentId = "9f000000-0000-4000-8000-000000000003";
  const eventId = "9f000000-0000-4000-8000-000000000004";
  const secondShipmentId = "9f000000-0000-4000-8000-000000000005";
  const now = "2026-08-16T12:00:00.000Z";
  try {
    await pool.query("DELETE FROM shipment_events WHERE shipment_id::text IN ($1,$2)", [shipmentId, secondShipmentId]);
    await pool.query("DELETE FROM shipments WHERE id::text IN ($1,$2)", [shipmentId, secondShipmentId]);
    await pool.query("DELETE FROM orders WHERE id::text = $1", [orderId]);
    await pool.query("DELETE FROM users WHERE email = 'shipment-admin@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'shipment-admin@example.com','ACTIVE')", [customer]);
    await pool.query("INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at) VALUES ($1,'ORD-SHP-1',$2,'CONFIRMED','BDT',1000,0,0,1000,now(),now(),now())", [orderId, customer]);

    const created = await repository.create({ id: shipmentId, orderId, courier: "Pathao", trackingId: null, packageType: "box", weight: 1.2, codAmount: 0, shippingCharge: 0, status: "DRAFT", createdAt: now });
    assert.equal(created.status, "DRAFT");

    const shipped = await repository.markShipped(shipmentId, "TRK-SHP-1", now);
    assert.equal(shipped.status, "shipped");
    assert.equal(shipped.record.status, "SHIPPED");
    assert.equal(shipped.record.trackingId, "TRK-SHP-1");

    const delivered = await repository.markDelivered(shipmentId, now);
    assert.equal(delivered.status, "delivered");
    assert.equal(delivered.record.status, "DELIVERED");

    const event = await repository.recordEvent({ id: eventId, shipmentId, status: "DELIVERED", providerStatusRaw: "delivered", occurredAt: now });
    assert.equal(event.id, eventId);

    // A duplicate tracking id is rejected at the database level.
    await assert.rejects(
      repository.create({ id: secondShipmentId, orderId, courier: "Pathao", trackingId: "TRK-SHP-1", packageType: "box", weight: 1, codAmount: 0, shippingCharge: 0, status: "DRAFT", createdAt: now }),
      (error) => error.code === "23505"
    );
  } finally {
    await pool.end();
  }
});
