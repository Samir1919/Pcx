import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresItemCostRepository } from "../../src/modules/inventory/postgres-item-cost-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("item cost repository appends entries and sums totals server-side", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresItemCostRepository({ pool });
  const productModelId = "82000000-0000-0000-0000-000000000001"; // seeded catalog model
  const admin = "6b000000-0000-4000-8000-000000000011";
  const itemId = "8a000000-0000-4000-8000-000000000099";
  const costA = "8a000000-0000-4000-8000-00000000009a";
  const costB = "8a000000-0000-4000-8000-00000000009b";
  const now = "2026-09-01T00:00:00.000Z";
  const later = "2026-09-01T01:00:00.000Z";
  try {
    await pool.query("DELETE FROM item_costs WHERE inventory_item_id = $1", [itemId]);
    await pool.query("DELETE FROM inventory_items WHERE id = $1", [itemId]);
    await pool.query("DELETE FROM users WHERE id = $1", [admin]);
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'cost-admin@example.com','ACTIVE')", [admin]);
    await pool.query(
      "INSERT INTO inventory_items(id, pcx_item_id, product_model_id, acquisition_cost, status, received_at, created_at, updated_at) VALUES ($1,'PCX-COST-99',$2,4200,'RECEIVED',$3,$3,$3)",
      [itemId, productModelId, now]
    );

    await repository.create({ id: costA, inventoryItemId: itemId, costType: "TESTING", amount: 100, reference: null, recordedBy: admin, createdAt: now });
    await repository.create({ id: costB, inventoryItemId: itemId, costType: "PACKAGING", amount: 25.5, reference: "Box", recordedBy: admin, createdAt: later });

    const entries = await repository.listByInventoryItem(itemId);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].costType, "PACKAGING"); // newest first

    const totals = await repository.totalByInventoryItem(itemId);
    assert.equal(totals.seed, 4200);
    assert.equal(totals.allocated, 125.5);
    assert.equal(totals.totalCost, 4325.5);

    const byType = await repository.sumByType();
    const testing = byType.find((r) => r.costType === "TESTING");
    assert.ok(testing && testing.total >= 100, "aggregate must include the appended TESTING cost");
  } finally {
    await pool.end();
  }
});
