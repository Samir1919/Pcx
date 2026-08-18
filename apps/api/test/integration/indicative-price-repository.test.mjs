import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresIndicativePriceRepository } from "../../src/modules/pricing/postgres-indicative-price-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("indicative price repository archives previous active row and enforces one active per target", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresIndicativePriceRepository({ pool });
  const admin = "6b000000-0000-4000-8000-000000000001";
  const modelId = "82000000-0000-0000-0000-000000000001"; // seeded catalog model
  const firstId = "6b000000-0000-4000-8000-000000000002";
  const secondId = "6b000000-0000-4000-8000-000000000003";
  const now = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM indicative_prices WHERE product_model_id::text = $1", [modelId]);
    await pool.query("DELETE FROM users WHERE id = $1", [admin]);
    await pool.query("INSERT INTO users(id,email,status) VALUES ($1,'price-admin@example.com','ACTIVE')", [admin]);

    await repository.upsertActive({ id: firstId, productModelId: modelId, categoryId: null, lowValue: 1000, highValue: 2000, setBy: admin, createdAt: now });
    await repository.upsertActive({ id: secondId, productModelId: modelId, categoryId: null, lowValue: 1500, highValue: 2500, setBy: admin, createdAt: now });

    const active = await repository.findActiveByProductModel(modelId);
    assert.equal(active.id, secondId);
    assert.equal(active.lowValue, 1500);

    const history = await repository.list({ limit: 50 });
    const modelRows = history.filter((r) => r.productModelId === modelId);
    assert.equal(modelRows.length, 2);
    const archived = modelRows.find((r) => r.id === firstId);
    assert.equal(archived.status, "ARCHIVED");
    assert.ok(archived.archivedAt);
  } finally {
    await pool.end();
  }
});
