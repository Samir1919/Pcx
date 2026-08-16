import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresInventoryRepository } from "../../src/modules/inventory/postgres-inventory-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("inventory intake persists item and blocks duplicate serial identifier", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresInventoryRepository({ pool });
  const productModelId = "82000000-0000-0000-0000-000000000001"; // seeded catalog model
  const itemA = "8a000000-0000-4000-8000-000000000001";
  const itemB = "8a000000-0000-4000-8000-000000000002";
  const serialA = "8a000000-0000-4000-8000-000000000003";
  const serialB = "8a000000-0000-4000-8000-000000000004";
  const now = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM serial_identifiers WHERE inventory_item_id IN ($1,$2)", [itemA, itemB]);
    await pool.query("DELETE FROM inventory_items WHERE id IN ($1,$2)", [itemA, itemB]);

    const first = await repository.createWithIdentifiers(
      { id: itemA, pcxItemId: "PCX-TEST-1", productModelId, acquisitionId: null, status: "RECEIVED", receivedAt: now, createdAt: now, updatedAt: now },
      [{ id: serialA, inventoryItemId: itemA, identifierType: "SERIAL", valueNormalized: "SN-123", valueDisplay: "SN-123", isPrimary: true, createdAt: now }],
      now
    );
    assert.equal(first.item.id, itemA);
    assert.equal(first.identifiers[0].valueNormalized, "SN-123");

    await assert.rejects(
      repository.createWithIdentifiers(
        { id: itemB, pcxItemId: "PCX-TEST-2", productModelId, acquisitionId: null, status: "RECEIVED", receivedAt: now, createdAt: now, updatedAt: now },
        [{ id: serialB, inventoryItemId: itemB, identifierType: "SERIAL", valueNormalized: "SN-123", valueDisplay: "SN-123", isPrimary: true, createdAt: now }],
        now
      ),
      (error) => error.code === "23505"
    );

    assert.equal((await repository.findById(itemA)).pcxItemId, "PCX-TEST-1");
    assert.equal((await repository.findById(itemB)), null);
    assert.equal((await repository.list()).some((item) => item.id === itemA), true);
  } finally {
    await pool.end();
  }
});
