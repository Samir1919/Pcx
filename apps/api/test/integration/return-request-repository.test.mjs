import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresReturnRequestRepository } from "../../src/modules/warranty/postgres-return-request-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("return request repository enforces one-refundable-per-item and settles once", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresReturnRequestRepository({ pool });
  const customer = "a0000000-0000-4000-8000-000000000001";
  const productModelId = "82000000-0000-0000-0000-000000000001";
  const inventoryItemId = "a0000000-0000-4000-8000-000000000002";
  const orderId = "a0000000-0000-4000-8000-000000000003";
  const orderItemId = "a0000000-0000-4000-8000-000000000004";
  const returnId = "a0000000-0000-4000-8000-000000000005";
  const duplicateReturnId = "a0000000-0000-4000-8000-000000000006";
  const now = "2026-08-16T12:00:00.000Z";
  try {
    await pool.query("DELETE FROM return_requests WHERE order_item_id::text = $1", [orderItemId]);
    // Foreign-key ordering: shipments/webhook events/events and order_items
    // reference the order with RESTRICT, so clear them before the order.
    await pool.query("DELETE FROM shipment_webhook_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text = $1)", [orderId]);
    await pool.query("DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text = $1)", [orderId]);
    await pool.query("DELETE FROM shipments WHERE order_id::text = $1", [orderId]);
    await pool.query("DELETE FROM order_items WHERE id::text = $1", [orderItemId]);
    await pool.query("DELETE FROM orders WHERE id::text = $1", [orderId]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text = $1", [inventoryItemId]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [inventoryItemId]);
    await pool.query("DELETE FROM user_roles WHERE user_id::text = $1", [customer]);
    await pool.query("DELETE FROM users WHERE email = 'return-customer@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'return-customer@example.com','ACTIVE')", [customer]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1,'PCX-RETURN', $2, 'APPROVED', now(), now(), now())", [inventoryItemId, productModelId]);
    await pool.query("INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at) VALUES ($1,'ORD-RET-1',$2,'DELIVERED','BDT',1000,0,0,1000,now(),now(),now())", [orderId, customer]);
    await pool.query("INSERT INTO order_items(id, order_id, inventory_item_id, product_model_id, pcx_item_id_snapshot, product_name_snapshot, spec_snapshot, unit_price) VALUES ($1,$2,$3,$4,'PCX-RETURN','GPU','{}'::jsonb,1000)", [orderItemId, orderId, inventoryItemId, productModelId]);

    const created = await repository.create({ id: returnId, orderItemId, reasonCode: "DOA", customerNotes: null, requestedAt: now });
    assert.equal(created.status, "REQUESTED");

    // Duplicate refundable return for the same item is rejected.
    await assert.rejects(
      repository.create({ id: duplicateReturnId, orderItemId, reasonCode: "DOA", customerNotes: null, requestedAt: now }),
      (error) => error.code === "23505"
    );

    const approved = await repository.approve(returnId, now);
    assert.equal(approved.status, "approved");
    const received = await repository.markReceived(returnId, now);
    assert.equal(received.status, "received");
    const refunded = await repository.settleRefund(returnId, 1000, now);
    assert.equal(refunded.status, "refunded");
    assert.equal(refunded.record.resolutionAmount, 1000);

    // Settling again returns not_refundable.
    assert.deepEqual(await repository.settleRefund(returnId, 1000, now), { status: "not_refundable" });
  } finally {
    await pool.end();
  }
});
