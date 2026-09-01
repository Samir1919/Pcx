import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresWarrantyClaimRepository } from "../../src/modules/warranty/postgres-warranty-claim-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("warranty/claim repository persists warranty, claim, resolution, and settles once", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresWarrantyClaimRepository({ pool });
  const approver = "b0000000-0000-4000-8000-000000000001";
  const productModelId = "82000000-0000-0000-0000-000000000001";
  const inventoryItemId = "b0000000-0000-4000-8000-000000000002";
  const orderId = "b0000000-0000-4000-8000-000000000003";
  const orderItemId = "b0000000-0000-4000-8000-000000000004";
  const warrantyId = "b0000000-0000-4000-8000-000000000005";
  const claimId = "b0000000-0000-4000-8000-000000000006";
  const resolutionId = "b0000000-0000-4000-8000-000000000007";
  const now = "2026-08-16T12:00:00.000Z";
  try {
    await pool.query("DELETE FROM claim_resolutions WHERE claim_id::text = $1", [claimId]);
    await pool.query("DELETE FROM claims WHERE id::text = $1", [claimId]);
    await pool.query("DELETE FROM warranties WHERE id::text = $1", [warrantyId]);
    // Foreign-key ordering: return_requests and shipments reference the order
    // (or its items) with RESTRICT, so they must be cleared before the order.
    await pool.query("DELETE FROM return_requests WHERE order_item_id::text = $1", [orderItemId]);
    await pool.query("DELETE FROM shipment_webhook_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text = $1)", [orderId]);
    await pool.query("DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id::text = $1)", [orderId]);
    await pool.query("DELETE FROM shipments WHERE order_id::text = $1", [orderId]);
    await pool.query("DELETE FROM order_items WHERE id::text = $1", [orderItemId]);
    await pool.query("DELETE FROM orders WHERE id::text = $1", [orderId]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text = $1", [inventoryItemId]);
    await pool.query("DELETE FROM item_costs WHERE inventory_item_id::text = $1", [inventoryItemId]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [inventoryItemId]);
    await pool.query("DELETE FROM users WHERE email = 'warranty-approver@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'warranty-approver@example.com','ACTIVE')", [approver]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1,'PCX-WARR', $2, 'APPROVED', now(), now(), now())", [inventoryItemId, productModelId]);
    await pool.query("INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at) VALUES ($1,'ORD-WARR-1',$2,'DELIVERED','BDT',1000,0,0,1000,now(),now(),now())", [orderId, approver]);
    await pool.query("INSERT INTO order_items(id, order_id, inventory_item_id, product_model_id, pcx_item_id_snapshot, product_name_snapshot, spec_snapshot, unit_price) VALUES ($1,$2,$3,$4,'PCX-WARR','GPU','{}'::jsonb,1000)", [orderItemId, orderId, inventoryItemId, productModelId]);

    const warranty = await repository.createWarranty({ id: warrantyId, orderItemId, inventoryItemId, policySnapshot: { days: 365 }, startsAt: "2026-08-16T00:00:00.000Z", endsAt: "2027-08-16T00:00:00.000Z" });
    assert.equal(warranty.status, "ACTIVE");

    const claim = await repository.createClaim({ id: claimId, warrantyId, orderItemId, reasonCode: "DEAD", symptoms: "no power", requestedAt: now });
    assert.equal(claim.status, "REQUESTED");

    const resolution = await repository.createResolution({ id: resolutionId, claimId, resolutionType: "REPLACE", notes: null, costAmount: 0, approvedBy: approver, createdAt: now });
    assert.equal(resolution.resolutionType, "REPLACE");

    const resolved = await repository.markClaimResolved(claimId, now);
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.record.status, "RESOLVED");

    assert.deepEqual(await repository.markClaimResolved(claimId, now), { status: "not_resolvable" });
  } finally {
    await pool.end();
  }
});
