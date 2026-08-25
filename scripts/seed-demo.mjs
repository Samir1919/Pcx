/**
 * Idempotent demo/mockup data seeder.
 *
 * Ensures database migrations are current, then inserts a small, consistent
 * sample dataset across every module so the admin/web UIs and public APIs have
 * data to show without manual setup. This is development/demo data only.
 *
 *   npm run seed:demo
 *
 * Safety:
 * - Every row uses a fixed UUID and an `INSERT ... WHERE NOT EXISTS` guard, so
 *   re-running is a no-op (idempotent).
 * - It never deletes existing data and never touches production.
 * - Demo users use documented development-only passwords (see README) and are
 *   intended only for the local demo; never create these in production.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runMigrations } from "../apps/api/src/infrastructure/database/migrate.mjs";
import { hashPassword } from "../apps/api/src/modules/identity/password.mjs";

// Minimal `.env` loader (same behavior as scripts/dev.mjs): reads the
// repository-root `.env` and never overrides an existing environment variable.
try {
  for (const rawLine of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key !== "" && !(key in process.env)) process.env[key] = value;
  }
} catch {
  // No .env is acceptable when DATABASE_URL is already set; the guard below handles it.
}

if (!process.env.DATABASE_URL) {
  process.stderr.write("[seed] DATABASE_URL is not set. Copy `.env.example` to `.env` or export DATABASE_URL, then re-run `npm run seed:demo`.\n");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

// Seeded references from migrations 0002 (roles) and 0006 (catalog).
const ROLES = {
  CUSTOMER: "20000000-0000-0000-0000-000000000001",
  ADMIN: "20000000-0000-0000-0000-000000000007"
};
const CATEGORY_GPU = "80000000-0000-0000-0000-000000000003";
const PRODUCT = {
  TOWER: "82000000-0000-0000-0000-000000000001",
  MACBOOK: "82000000-0000-0000-0000-000000000005",
  RTX3060: "82000000-0000-0000-0000-000000000006"
};

const DEMO = {
  admin: "a0000000-0000-0000-0000-000000000001",
  customer: "a0000000-0000-0000-0000-000000000002",
  seller: "a0000000-0000-0000-0000-000000000003",
  address: "b0000000-0000-0000-0000-000000000001",
  sellSubmitted: "c0000000-0000-0000-0000-000000000001",
  sellDraft: "c0000000-0000-0000-0000-000000000002",
  declaration: "d0000000-0000-0000-0000-000000000001",
  inv3060: "e0000000-0000-0000-0000-000000000001",
  invMacbook: "e0000000-0000-0000-0000-000000000002",
  invTower: "e0000000-0000-0000-0000-000000000003",
  serial3060: "f0000000-0000-0000-0000-000000000001",
  serialMacbook: "f0000000-0000-0000-0000-000000000002",
  serialTower: "f0000000-0000-0000-0000-000000000003",
  template: "f1000000-0000-0000-0000-000000000001",
  templateItem1: "f2000000-0000-0000-0000-000000000001",
  templateItem2: "f2000000-0000-0000-0000-000000000002",
  listing3060: "90000000-0000-0000-0000-000000000001",
  listingMacbook: "90000000-0000-0000-0000-000000000002",
  price3060: "90100000-0000-0000-0000-000000000001",
  priceMacbook: "90100000-0000-0000-0000-000000000002",
  reservation: "91000000-0000-0000-0000-000000000001",
  offer: "93000000-0000-0000-0000-000000000001",
  acquisition: "94000000-0000-0000-0000-000000000001",
  order: "95000000-0000-0000-0000-000000000001",
  orderItem: "96000000-0000-0000-0000-000000000001",
  payment: "97000000-0000-0000-0000-000000000001",
  shipment: "98000000-0000-0000-0000-000000000001",
  shipmentEvent1: "98100000-0000-0000-0000-000000000001",
  shipmentEvent2: "98100000-0000-0000-0000-000000000002",
  returnRequest: "99000000-0000-0000-0000-000000000001",
  warranty: "9a000000-0000-0000-0000-000000000001",
  claim: "9b000000-0000-0000-0000-000000000001",
  notification: "9c000000-0000-0000-0000-000000000001"
};

// Demo passwords (development only, documented in README). The admin is a
// privileged role and completes login with the dev MFA code (default 123456).
const DEMO_PASSWORDS = {
  admin: "DemoAdmin123!",
  customer: "DemoCustomer1!",
  seller: "DemoSeller12!"
};

const seed = async () => {
  process.stdout.write("[seed] ensuring migrations are current…\n");
  await runMigrations({ connectionString });

  const pool = new pg.Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- identity ---
    // Re-hash from scratch only when the demo user is missing; a fixed hash is
    // intentionally not stored so argon2 parameters can evolve between runs.
    const [
      adminHash,
      customerHash,
      sellerHash
    ] = await Promise.all([hashPassword(DEMO_PASSWORDS.admin), hashPassword(DEMO_PASSWORDS.customer), hashPassword(DEMO_PASSWORDS.seller)]);

    const insertUser = (id, email, phone, status, passwordHash) => client.query(
      `INSERT INTO users(id, email, phone, password_hash, status, contact_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, now(), now())
       ON CONFLICT (id) DO UPDATE
         SET password_hash = CASE WHEN users.password_hash IS NULL THEN EXCLUDED.password_hash ELSE users.password_hash END`,
      [id, email, phone, passwordHash, status]
    );
    await insertUser(DEMO.admin, "demo-admin@example.com", "+8801700000001", "ACTIVE", adminHash);
    await insertUser(DEMO.customer, "demo-customer@example.com", "+8801700000002", "ACTIVE", customerHash);
    await insertUser(DEMO.seller, "demo-seller@example.com", "+8801700000003", "ACTIVE", sellerHash);

    for (const [userId, roleId] of [
      [DEMO.admin, ROLES.ADMIN],
      [DEMO.customer, ROLES.CUSTOMER],
      [DEMO.seller, ROLES.CUSTOMER]
    ]) {
      await client.query(
        `INSERT INTO user_roles(user_id, role_id, assigned_at)
         SELECT $1, $2, now() WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2)`,
        [userId, roleId]
      );
    }

    await client.query(
      `INSERT INTO addresses(id, user_id, label, recipient_name, phone, address_line_1, area, city, postal_code, is_default, created_at, updated_at)
       SELECT $1, $2, 'Home', 'Demo Customer', '+8801700000002', 'House 12, Road 5', 'Dhanmondi', 'Dhaka', '1209', true, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE id = $1)`,
      [DEMO.address, DEMO.customer]
    );

    // --- sell requests (one SUBMITTED, one DRAFT) ---
    await client.query(
      `INSERT INTO sell_requests(id, public_request_no, user_id, contact_name, contact_phone, contact_email, category_id, product_model_id, status, fulfilment_preference, submitted_at, created_at, updated_at)
       SELECT $1, $2, $3, 'Demo Seller', '+8801700000003', 'seller@example.com', $4, $5, 'SUBMITTED', 'COURIER', now(), now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM sell_requests WHERE id = $1)`,
      [DEMO.sellSubmitted, "DEMO-SR-0001", DEMO.seller, CATEGORY_GPU, PRODUCT.RTX3060]
    );
    await client.query(
      `INSERT INTO sell_requests(id, public_request_no, user_id, contact_name, contact_phone, contact_email, category_id, product_model_id, status, fulfilment_preference, submitted_at, created_at, updated_at)
       SELECT $1, $2, $3, 'Demo Seller', '+8801700000003', 'seller@example.com', $4, $5, 'DRAFT', 'PICKUP', NULL, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM sell_requests WHERE id = $1)`,
      [DEMO.sellDraft, "DEMO-SR-0002", DEMO.seller, CATEGORY_GPU, PRODUCT.MACBOOK]
    );
    await client.query(
      `INSERT INTO seller_declarations(id, sell_request_id, age_estimate, warranty_remaining, repair_declared, box_available, invoice_available, ownership_declared, created_at)
       SELECT $1, $2, '2 years', 'none', false, true, true, true, now()
       WHERE NOT EXISTS (SELECT 1 FROM seller_declarations WHERE sell_request_id = $2)`,
      [DEMO.declaration, DEMO.sellSubmitted]
    );

    // --- inventory + serials ---
    const insertInventory = (id, pcxItemId, productModelId) => client.query(
      `INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at)
       SELECT $1, $2, $3, 'APPROVED', now(), now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE id = $1)`,
      [id, pcxItemId, productModelId]
    );
    await insertInventory(DEMO.inv3060, "PCX-DEMO-3060-01", PRODUCT.RTX3060);
    await insertInventory(DEMO.invMacbook, "PCX-DEMO-MBA-01", PRODUCT.MACBOOK);
    await insertInventory(DEMO.invTower, "PCX-DEMO-TOWER-01", PRODUCT.TOWER);

    const insertSerial = (id, inventoryItemId, value) => client.query(
      `INSERT INTO serial_identifiers(id, inventory_item_id, identifier_type, value_normalized, value_display, is_primary, created_at)
       SELECT $1, $2, 'SERIAL', lower($3), $3, true, now()
       WHERE NOT EXISTS (SELECT 1 FROM serial_identifiers WHERE id = $1)`,
      [id, inventoryItemId, value]
    );
    await insertSerial(DEMO.serial3060, DEMO.inv3060, "SN-3060-DEMO-001");
    await insertSerial(DEMO.serialMacbook, DEMO.invMacbook, "SN-MBA-DEMO-001");
    await insertSerial(DEMO.serialTower, DEMO.invTower, "SN-TOWER-DEMO-001");

    // --- inspection template (GPU) ---
    await client.query(
      `INSERT INTO inspection_templates(id, category_id, name, version, status, created_at)
       SELECT $1, $2, 'GPU Functional Check', '1', 'ACTIVE', now()
       WHERE NOT EXISTS (SELECT 1 FROM inspection_templates WHERE id = $1)`,
      [DEMO.template, CATEGORY_GPU]
    );
    await client.query(
      `INSERT INTO inspection_template_items(id, template_id, code, label, result_type, is_mandatory, is_critical, sort_order, created_at)
       SELECT $1, $2, 'display_output', 'Display output', 'PASS_FAIL', true, true, 1, now()
       WHERE NOT EXISTS (SELECT 1 FROM inspection_template_items WHERE id = $1)`,
      [DEMO.templateItem1, DEMO.template]
    );
    await client.query(
      `INSERT INTO inspection_template_items(id, template_id, code, label, result_type, unit, is_mandatory, sort_order, created_at)
       SELECT $1, $2, 'fan_speed_rpm', 'Fan speed', 'NUMBER', 'RPM', false, 2, now()
       WHERE NOT EXISTS (SELECT 1 FROM inspection_template_items WHERE id = $1)`,
      [DEMO.templateItem2, DEMO.template]
    );

    // --- listings + prices (PUBLISHED requires slug + published_at) ---
    const insertListing = (id, inventoryItemId, slug) => client.query(
      `INSERT INTO listings(id, inventory_item_id, status, public_slug, published_at, created_at)
       SELECT $1, $2, 'PUBLISHED', $3, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM listings WHERE id = $1)`,
      [id, inventoryItemId, slug]
    );
    await insertListing(DEMO.listing3060, DEMO.inv3060, "pcx-rtx-3060-demo");
    await insertListing(DEMO.listingMacbook, DEMO.invMacbook, "pcx-macbook-air-m1-demo");

    await client.query(
      `INSERT INTO listing_prices(id, listing_id, price, valid_from, reason, set_by_user_id)
       SELECT $1, $2, $3, now(), 'demo seed', $4
       WHERE NOT EXISTS (SELECT 1 FROM listing_prices WHERE id = $1)`,
      [DEMO.price3060, DEMO.listing3060, 28000, DEMO.admin]
    );
    await client.query(
      `INSERT INTO listing_prices(id, listing_id, price, valid_from, reason, set_by_user_id)
       SELECT $1, $2, $3, now(), 'demo seed', $4
       WHERE NOT EXISTS (SELECT 1 FROM listing_prices WHERE id = $1)`,
      [DEMO.priceMacbook, DEMO.listingMacbook, 65000, DEMO.admin]
    );

    // --- indicative prices (model-level, so public quote ranges resolve) ---
    // These are estimated market ranges, never final offers and never
    // acquisition cost. They power the anonymous Sell-to-PCX quote preview.
    const indicativeRanges = [
      ["82000000-0000-0000-0000-000000000001", 40000, 120000],
      ["82000000-0000-0000-0000-000000000002", 25000, 70000],
      ["82000000-0000-0000-0000-000000000003", 35000, 95000],
      ["82000000-0000-0000-0000-000000000004", 28000, 80000],
      ["82000000-0000-0000-0000-000000000005", 55000, 140000],
      ["82000000-0000-0000-0000-000000000006", 18000, 32000],
      ["82000000-0000-0000-0000-000000000007", 22000, 40000],
      ["82000000-0000-0000-0000-000000000008", 15000, 28000],
      ["82000000-0000-0000-0000-000000000009", 10000, 18000],
      ["82000000-0000-0000-0000-000000000010", 9000, 17000],
      ["82000000-0000-0000-0000-000000000011", 12000, 24000],
      ["82000000-0000-0000-0000-000000000012", 10000, 20000],
      ["82000000-0000-0000-0000-000000000013", 2500, 6000],
      ["82000000-0000-0000-0000-000000000014", 2500, 6000],
      ["82000000-0000-0000-0000-000000000015", 5000, 12000],
      ["82000000-0000-0000-0000-000000000016", 2000, 5000],
      ["82000000-0000-0000-0000-000000000017", 3000, 7000],
      ["82000000-0000-0000-0000-000000000018", 8000, 18000],
      ["82000000-0000-0000-0000-000000000019", 5000, 12000],
      ["82000000-0000-0000-0000-000000000020", 3000, 8000]
    ];
    for (let index = 0; index < indicativeRanges.length; index += 1) {
      const [productModelId, low, high] = indicativeRanges[index];
      const priceId = `a2000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;
      await client.query(
        `INSERT INTO indicative_prices(id, product_model_id, low_value, high_value, status, set_by, created_at)
         SELECT $1, $2, $3, $4, 'ACTIVE', $5, now()
         WHERE NOT EXISTS (
           SELECT 1 FROM indicative_prices WHERE product_model_id = $2 AND status = 'ACTIVE'
         )`,
        [priceId, productModelId, low, high, DEMO.admin]
      );
    }

    // --- reservation (one ACTIVE per item) ---
    // Idempotent by fixed id (not by "has an ACTIVE row for the item"), because a
    // previous seed run's reservation can later expire; re-inserting the same id
    // then violates reservations_pkey. The one-active-per-item invariant is still
    // preserved by rejecting any other ACTIVE row for the same item below.
    await client.query(
      `INSERT INTO reservations(id, inventory_item_id, reserved_by_user_id, status, reserved_until, created_at)
       SELECT $1, $2, $3, 'ACTIVE', now() + interval '1 day', now()
       WHERE NOT EXISTS (SELECT 1 FROM reservations WHERE id = $1)
         AND NOT EXISTS (SELECT 1 FROM reservations WHERE inventory_item_id = $2 AND status = 'ACTIVE')`,
      [DEMO.reservation, DEMO.invTower, DEMO.customer]
    );

    // --- acquisition flow (offer -> accepted offer -> paid acquisition) ---
    await client.query(
      `INSERT INTO offers(id, sell_request_id, amount, status, expires_at, accepted_at, created_by, created_at)
       SELECT $1, $2, 24000, 'ACCEPTED', now() + interval '7 days', now(), $3, now()
       WHERE NOT EXISTS (SELECT 1 FROM offers WHERE id = $1)`,
      [DEMO.offer, DEMO.sellSubmitted, DEMO.admin]
    );
    await client.query(
      `INSERT INTO acquisitions(id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key)
       SELECT $1, $2, $3, $4, 'SELL_TO_PCX', 24000, 'PAID', now(), now(), 'demo-acq-0001'
       WHERE NOT EXISTS (SELECT 1 FROM acquisitions WHERE id = $1)`,
      [DEMO.acquisition, DEMO.sellSubmitted, DEMO.offer, DEMO.seller]
    );
    await client.query(
      `UPDATE inventory_items SET acquisition_id = $2, updated_at = now()
       WHERE id = $1 AND acquisition_id IS NULL`,
      [DEMO.inv3060, DEMO.acquisition]
    );

    // --- order + payment (DELIVERED, confirmed) ---
    await client.query(
      `INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at)
       SELECT $1, $2, $3, 'DELIVERED', 'BDT', 28000, 200, 0, 28200, now(), now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM orders WHERE id = $1)`,
      [DEMO.order, "DEMO-ORD-0001", DEMO.customer]
    );
    await client.query(
      `INSERT INTO order_items(id, order_id, inventory_item_id, listing_id, product_model_id, pcx_item_id_snapshot, product_name_snapshot, spec_snapshot, unit_price, created_at)
       SELECT $1, $2, $3, $4, $5, $6, 'GeForce RTX 3060 12GB', '{}'::jsonb, 28000, now()
       WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE id = $1)`,
      [DEMO.orderItem, DEMO.order, DEMO.inv3060, DEMO.listing3060, PRODUCT.RTX3060, "PCX-DEMO-3060-01"]
    );
    await client.query(
      `INSERT INTO payments(id, order_id, payment_direction, provider, provider_transaction_id, method, amount, status, initiated_at, confirmed_at, created_at)
       SELECT $1, $2, 'INBOUND', 'sandbox-bkash', 'demo-txn-0001', 'mobile', 28200, 'CONFIRMED', now(), now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM payments WHERE id = $1)`,
      [DEMO.payment, DEMO.order]
    );

    // --- shipment + events (DELIVERED, so it needs shipped_at and delivered_at) ---
    await client.query(
      `INSERT INTO shipments(id, order_id, courier, tracking_id, package_type, weight, status, shipped_at, delivered_at, created_at)
       SELECT $1, $2, 'Pathao', 'DEMO-TRK-0001', 'box', 2.5, 'DELIVERED', now() - interval '1 day', now(), now() - interval '1 day'
       WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE id = $1)`,
      [DEMO.shipment, DEMO.order]
    );
    await client.query(
      `INSERT INTO shipment_events(id, shipment_id, status, provider_status_raw, occurred_at)
       SELECT $1, $2, 'SHIPPED', 'PICKED_UP', now() - interval '1 day'
       WHERE NOT EXISTS (SELECT 1 FROM shipment_events WHERE id = $1)`,
      [DEMO.shipmentEvent1, DEMO.shipment]
    );
    await client.query(
      `INSERT INTO shipment_events(id, shipment_id, status, provider_status_raw, occurred_at)
       SELECT $1, $2, 'DELIVERED', 'DELIVERED', now()
       WHERE NOT EXISTS (SELECT 1 FROM shipment_events WHERE id = $1)`,
      [DEMO.shipmentEvent2, DEMO.shipment]
    );

    // --- return request (REQUESTED) ---
    await client.query(
      `INSERT INTO return_requests(id, order_item_id, status, reason_code, customer_notes, requested_at, created_at)
       SELECT $1, $2, 'REQUESTED', 'DOA', 'Demo return request', now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM return_requests WHERE order_item_id = $2 AND status IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED'))`,
      [DEMO.returnRequest, DEMO.orderItem]
    );

    // --- warranty + claim ---
    await client.query(
      `INSERT INTO warranties(id, order_item_id, inventory_item_id, policy_snapshot, status, starts_at, ends_at, created_at)
       SELECT $1, $2, $3, '{}'::jsonb, 'ACTIVE', now(), now() + interval '1 year', now()
       WHERE NOT EXISTS (SELECT 1 FROM warranties WHERE order_item_id = $2)`,
      [DEMO.warranty, DEMO.orderItem, DEMO.inv3060]
    );
    await client.query(
      `INSERT INTO claims(id, warranty_id, order_item_id, status, reason_code, symptoms, requested_at, created_at)
       SELECT $1, $2, $3, 'REQUESTED', 'PERFORMANCE', 'Demo claim', now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM claims WHERE id = $1)`,
      [DEMO.claim, DEMO.warranty, DEMO.orderItem]
    );

    // --- notification ---
    await client.query(
      `INSERT INTO notifications(id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, created_at)
       SELECT $1, $2, 'EMAIL', 'ORDER_CONFIRMED', 'order', $3, 'PENDING', '{}'::jsonb, now()
       WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE id = $1)`,
      [DEMO.notification, DEMO.customer, DEMO.order]
    );

    // --- audit log (bigserial id auto) ---
    await client.query(
      `INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, reason, created_at)
       SELECT $1, 'seed.demo_created', 'platform', 'demo', 'demo dataset seeded', now()
       WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'seed.demo_created' AND entity_id = 'demo')`,
      [DEMO.admin]
    );

    await client.query("COMMIT");
    process.stdout.write("[seed] demo data seeded (idempotent; re-run is a no-op).\n");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch((error) => {
  process.stderr.write(`[seed] failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
