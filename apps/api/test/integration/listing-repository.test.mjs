import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresListingRepository } from "../../src/modules/listing/postgres-listing-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("listing repository persists draft, publishes with unique active constraint, and sets price", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresListingRepository({ pool });
  const admin = "9c000000-0000-4000-8000-000000000001";
  const itemId = "9c000000-0000-4000-8000-000000000002";
  const listingId = "9c000000-0000-4000-8000-000000000003";
  const priceId = "9c000000-0000-4000-8000-000000000004";
  const second = "9c000000-0000-4000-8000-000000000005";
  const now = "2026-08-16T12:00:00.000Z";
  const productModelId = "82000000-0000-0000-0000-000000000001"; // seeded catalog model
  try {
    await pool.query("DELETE FROM listing_prices WHERE listing_id::text = $1", [listingId]);
    await pool.query("DELETE FROM listing_prices WHERE listing_id::text = $1", [second]);
    await pool.query("DELETE FROM listings WHERE inventory_item_id::text = $1", [itemId]);
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id::text = $1", [itemId]);
    await pool.query("DELETE FROM item_costs WHERE inventory_item_id::text = $1", [itemId]);
    await pool.query("DELETE FROM inventory_items WHERE id::text = $1", [itemId]);
    await pool.query("DELETE FROM acquisitions WHERE accepted_offer_id::text = $1", ["9c000000-0000-4000-8000-000000000099"]);
    await pool.query("DELETE FROM users WHERE email = 'list-admin@example.com'");
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'list-admin@example.com','ACTIVE')", [admin]);
    await pool.query("INSERT INTO inventory_items(id, pcx_item_id, product_model_id, status, received_at, created_at, updated_at) VALUES ($1, 'PCX-TEST-LIST', $2, 'APPROVED', now(), now(), now())", [itemId, productModelId]);

    const draft = await repository.createDraft({ id: listingId, inventoryItemId: itemId, publicSlug: "pcx-test-list", warrantyPolicyId: null, status: "DRAFT", publishedAt: null, createdAt: now });
    assert.equal(draft.status, "DRAFT");

    const published = await repository.publish(listingId, "pcx-test-list", now);
    assert.equal(published.status, "published");
    assert.equal(published.record.status, "PUBLISHED");

    const price = await repository.createPrice({ id: priceId, listingId, price: 15000, validFrom: now, reason: null, setByUser: admin }, now);
    assert.equal(Number(price.price), 15000);

    const passport = await repository.findPublicPassport("PCX-TEST-LIST");
    assert.ok(passport);
    assert.equal(passport.pcx_item_id, "PCX-TEST-LIST");
    assert.equal(Number(passport.price), 15000);

    const search = await repository.searchPublished({ q: "PCX Gaming Tower", sort: "newest", limit: 10 });
    assert.equal(search.records.length, 1);
    assert.equal(search.records[0].pcx_item_id, "PCX-TEST-LIST");
    assert.equal(search.nextCursor, null);

    const adminList = await repository.listAdmin({ limit: 50 });
    const ownAdminRow = adminList.records.find((record) => record.pcx_item_id === "PCX-TEST-LIST");
    assert.ok(ownAdminRow, "own admin listing is present");
    assert.equal(Number(ownAdminRow.price), 15000);
    assert.ok(ownAdminRow.model_name);

    // A second active listing for the same item violates the unique index.
    await repository.createDraft({ id: second, inventoryItemId: itemId, publicSlug: "pcx-test-list-2", warrantyPolicyId: null, status: "DRAFT", publishedAt: null, createdAt: now });
    await assert.rejects(
      repository.publish(second, "pcx-test-list-2", now),
      (error) => error.code === "23505"
    );
  } finally {
    await pool.end();
  }
});
