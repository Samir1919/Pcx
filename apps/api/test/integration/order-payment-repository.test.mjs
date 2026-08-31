import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresOrderPaymentRepository } from "../../src/modules/commerce/postgres-order-payment-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("order/payment repository persists order, snapshot items, and idempotent payment", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresOrderPaymentRepository({ pool });
  const customer = "9e000000-0000-4000-8000-000000000001";
  const productModelId = "82000000-0000-0000-0000-000000000001"; // seeded model
  const itemA = "9e000000-0000-4000-8000-000000000002";
  const itemB = "9e000000-0000-4000-8000-000000000003";
  const orderId = "9e000000-0000-4000-8000-000000000004";
  const snapshotId = "9e000000-0000-4000-8000-000000000005";
  const paymentId = "9e000000-0000-4000-8000-000000000006";
  const now = "2026-08-16T12:00:00.000Z";
  try {
    await pool.query("DELETE FROM payments WHERE order_id::text = $1", [orderId]);
    await pool.query("DELETE FROM shipment_webhook_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text IN ($1,$2))", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text IN ($1,$2))", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM shipments WHERE order_id::text IN ($1,$2)", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM return_requests WHERE order_item_id::text IN (SELECT id::text FROM order_items WHERE order_id::text IN ($1,$2))", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM order_items WHERE order_id::text IN ($1,$2)", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM orders WHERE id::text IN ($1,$2)", [orderId, "9e000000-0000-4000-8000-000000000010"]);
    await pool.query("DELETE FROM listings WHERE inventory_item_id::text IN ($1,$2)", [itemA, itemB]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text IN ($1,$2)", [itemA, itemB]);
    await pool.query("DELETE FROM inventory_items WHERE id::text IN ($1,$2)", [itemA, itemB]);
    await pool.query("DELETE FROM users WHERE email = 'order-customer@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'order-customer@example.com','ACTIVE')", [customer]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1,'PCX-TEST-ORDER', $2, 'APPROVED', now(), now(), now())", [itemA, productModelId]);
    // A PUBLISHED listing is the sellable resource the order must claim
    // (PUBLISHED -> RESERVED) atomically.
    await pool.query(
      "INSERT INTO listings(id, inventory_item_id, status, public_slug, published_at, created_at) VALUES ($1,$2,'PUBLISHED','pcx-test-order',$3,$3)",
      ["9e000000-0000-4000-8000-000000000008", itemA, now]
    );

    const { order, items: createdItems } = await repository.createOrderWithItems(
      { id: orderId, userId: customer, currency: "BDT", subtotal: 1500, shippingAmount: 0, discountAmount: 0, totalAmount: 1500, placedAt: now },
      [{ id: snapshotId, orderId, inventoryItemId: itemA, listingId: null, productModelId, pcxItemId: "PCX-TEST-ORDER", productName: "GPU", grade: null, healthScore: null, unitPrice: 1500, specs: [] }]
    );
    assert.equal(order.userId, customer);
    assert.ok(order.orderNo.startsWith("ORD-"));
    assert.equal(createdItems[0].id, snapshotId);

    // Double-sell guard: the claimed listing is now RESERVED, not PUBLISHED.
    const listing = await pool.query("SELECT status FROM listings WHERE inventory_item_id::text = $1", [itemA]);
    assert.equal(listing.rows[0].status, "RESERVED");

    // A second order for the same physical item must be rejected atomically.
    await assert.rejects(
      repository.createOrderWithItems(
        { id: "9e000000-0000-4000-8000-000000000010", userId: customer, currency: "BDT", subtotal: 1500, shippingAmount: 0, discountAmount: 0, totalAmount: 1500, placedAt: now },
        [{ id: "9e000000-0000-4000-8000-000000000011", orderId: "9e000000-0000-4000-8000-000000000010", inventoryItemId: itemA, listingId: null, productModelId, pcxItemId: "PCX-TEST-ORDER", productName: "GPU", grade: null, healthScore: null, unitPrice: 1500, specs: [] }]
      ),
      (error) => error.code === "item_unavailable"
    );

    const payment = await repository.createPayment({ id: paymentId, orderId, direction: "INBOUND", provider: "bkash", providerTransactionId: "txn-order-1", method: "mobile", amount: 1500, initiatedAt: now });
    assert.equal(payment.status, "INITIATED");

    // Duplicate provider transaction id is rejected (idempotency).
    await assert.rejects(
      repository.createPayment({ id: "9e000000-0000-4000-8000-000000000099", orderId, direction: "INBOUND", provider: "bkash", providerTransactionId: "txn-order-1", method: "mobile", amount: 1500, initiatedAt: now }),
      (error) => error.code === "23505"
    );

    // Another customer cannot confirm this order's payment (ownership check).
    const otherCustomer = "9e000000-0000-4000-8000-000000000007";
    await pool.query("DELETE FROM users WHERE email = 'other-customer@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'other-customer@example.com','ACTIVE')", [otherCustomer]);
    assert.deepEqual(await repository.confirmPayment("txn-order-1", otherCustomer, now), { status: "not_confirmable" });

    const confirmed = await repository.confirmPayment("txn-order-1", customer, now);
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.record.status, "CONFIRMED");

    // Payment confirm advances the order and marks the claimed listing SOLD.
    const confirmedOrder = await pool.query("SELECT status FROM orders WHERE id::text = $1", [orderId]);
    assert.equal(confirmedOrder.rows[0].status, "CONFIRMED");
    const soldListing = await pool.query("SELECT status FROM listings WHERE inventory_item_id::text = $1", [itemA]);
    assert.equal(soldListing.rows[0].status, "SOLD");

    // Confirming again returns not_confirmable.
    assert.deepEqual(await repository.confirmPayment("txn-order-1", customer, now), { status: "not_confirmable" });
  } finally {
    await pool.end();
  }
});
