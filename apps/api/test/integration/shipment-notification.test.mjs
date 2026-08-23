import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresOrderPaymentRepository } from "../../src/modules/commerce/postgres-order-payment-repository.mjs";
import { createOrderPaymentService } from "../../src/modules/commerce/order-payment-service.mjs";
import { createPostgresShipmentRepository } from "../../src/modules/logistics/postgres-shipment-repository.mjs";
import { createShipmentService } from "../../src/modules/logistics/shipment-service.mjs";
import { createPostgresNotificationRepository } from "../../src/modules/notification/postgres-notification-repository.mjs";
import { createNotificationEmitter } from "../../src/modules/notification/notification-emitter.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

const adminAuth = { async authenticateAccess() { return { userId: "9e000000-0000-4000-8000-000000000030", status: "ACTIVE", roles: ["ADMIN"] }; } };

test("ship + deliver emits PENDING SHIPMENT_SHIPPED then ORDER_DELIVERED rows", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const productModelId = "82000000-0000-0000-0000-000000000001";
  const customer = "9e000000-0000-4000-8000-000000000021";
  const itemA = "9e000000-0000-4000-8000-000000000022";
  const listingId = "9e000000-0000-4000-8000-000000000023";
  const now = "2026-08-16T12:00:00.000Z";

  const customerAuth = { async authenticateAccess() { return { userId: customer, status: "ACTIVE", roles: ["CUSTOMER"] }; } };
  const orderPaymentRepository = createPostgresOrderPaymentRepository({ pool });
  const notificationRepository = createPostgresNotificationRepository({ pool });
  const notificationEmitter = createNotificationEmitter({ repository: notificationRepository });
  const orderPaymentService = createOrderPaymentService({ authService: customerAuth, repository: orderPaymentRepository, notificationEmitter });

  const shipmentService = createShipmentService({
    authService: adminAuth,
    repository: createPostgresShipmentRepository({ pool }),
    notificationEmitter,
    orderUserResolver: async ({ orderId }) => orderPaymentService.getUserIdByOrder(orderId)
  });

  try {
    // Clean any prior run artifacts in dependency order.
    await pool.query("DELETE FROM notifications WHERE user_id::text = $1", [customer]);
    await pool.query("DELETE FROM shipment_webhook_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text IN (SELECT id::text FROM orders WHERE user_id::text = $1))", [customer]);
    await pool.query("DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text IN (SELECT id::text FROM orders WHERE user_id::text = $1))", [customer]);
    await pool.query("DELETE FROM shipments WHERE order_id::text IN (SELECT id::text FROM orders WHERE user_id::text = $1)", [customer]);
    await pool.query("DELETE FROM payments WHERE order_id::text IN (SELECT id::text FROM orders WHERE user_id::text = $1)", [customer]);
    await pool.query("DELETE FROM order_items WHERE order_id::text IN (SELECT id::text FROM orders WHERE user_id::text = $1)", [customer]);
    await pool.query("DELETE FROM orders WHERE user_id::text = $1", [customer]);
    await pool.query("DELETE FROM listings WHERE inventory_item_id::text = $1", [itemA]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text = $1", [itemA]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [itemA]);
    await pool.query("DELETE FROM users WHERE id::text = $1", [customer]);

    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'ship-notif-customer@example.com','ACTIVE')", [customer]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1,'PCX-SHIP-NOTIF', $2, 'APPROVED', now(), now(), now())", [itemA, productModelId]);
    await pool.query("INSERT INTO listings(id, inventory_item_id, status, public_slug, published_at, created_at) VALUES ($1,$2,'PUBLISHED','pcx-ship-notif',$3,$3)", [listingId, itemA, now]);

    // 1. Customer creates the order (claims listing + snapshots facts).
    const created = await orderPaymentService.createOrder("access", {
      items: [{ inventoryItemId: itemA, productModelId, pcxItemId: "PCX-SHIP-NOTIF", productName: "GPU", unitPrice: 1500 }]
    });
    assert.equal(created.userId, customer);

    // 2. Admin creates + ships: expect a PENDING SHIPMENT_SHIPPED notification.
    const draft = await shipmentService.create("access", { orderId: created.id, courier: "Pathao", packageType: "box", weight: 1.2 });
    const shipped = await shipmentService.ship("access", draft.id, { line1: "1 Main St", city: "Dhaka", country: "BD" });

    const shippedRows = await pool.query(
      "SELECT notification_type, reference_type, reference_id, status FROM notifications WHERE user_id::text = $1 AND notification_type = 'SHIPMENT_SHIPPED'",
      [customer]
    );
    assert.equal(shippedRows.rowCount, 1);
    assert.equal(shippedRows.rows[0].status, "PENDING");
    assert.equal(shippedRows.rows[0].reference_type, "shipment");
    assert.equal(shippedRows.rows[0].reference_id, shipped.id);

    // 3. Admin delivers: expect a PENDING ORDER_DELIVERED notification.
    await shipmentService.deliver("access", shipped.id);

    const deliveredRows = await pool.query(
      "SELECT notification_type, reference_type, status FROM notifications WHERE user_id::text = $1 AND notification_type = 'ORDER_DELIVERED'",
      [customer]
    );
    assert.equal(deliveredRows.rowCount, 1);
    assert.equal(deliveredRows.rows[0].status, "PENDING");
    assert.equal(deliveredRows.rows[0].reference_type, "shipment");
  } finally {
    await pool.end();
  }
});
