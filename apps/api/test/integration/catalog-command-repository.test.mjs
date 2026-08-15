import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresCatalogCommandRepository } from "../../src/modules/catalog/postgres-catalog-command-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("catalog commands commit create/archive with actor audit atomically", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresCatalogCommandRepository({ pool });
  const actorId = "75000000-0000-0000-0000-000000000001";
  const categoryId = "75000000-0000-0000-0000-000000000002";
  const createdAt = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM auth_audit_events WHERE id IN ('75000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000004')");
    await pool.query("DELETE FROM categories WHERE id=$1", [categoryId]);
    await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    await pool.query("INSERT INTO users(id,email,status,contact_verified) VALUES ($1,'catalog-admin@example.com','ACTIVE',true)", [actorId]);
    const record = { id: categoryId, parentId: null, name: "Admin GPU", slug: "admin-gpu", status: "ACTIVE", sortOrder: 0, createdAt };
    const createdAudit = { id: "75000000-0000-0000-0000-000000000003", actorId, action: "CATALOG_CATEGORY_CREATED", targetType: "CATEGORY", targetId: categoryId, requestId: "create-request", changes: { status: "ACTIVE" }, occurredAt: createdAt };
    await repository.create(record, "category", createdAudit);
    const archivedAudit = { ...createdAudit, id: "75000000-0000-0000-0000-000000000004", action: "CATALOG_CATEGORY_ARCHIVED", requestId: "archive-request", changes: { status: "ARCHIVED" }, occurredAt: "2026-08-16T00:01:00.000Z" };
    assert.equal(await repository.archive(categoryId, "category", archivedAudit.occurredAt, archivedAudit), true);
    assert.equal(await repository.archive(categoryId, "category", archivedAudit.occurredAt, { ...archivedAudit, id: "75000000-0000-0000-0000-000000000005" }), false);
    const state = await pool.query("SELECT status,archived_at FROM categories WHERE id=$1", [categoryId]);
    assert.equal(state.rows[0].status, "ARCHIVED");
    assert.ok(state.rows[0].archived_at);
    const events = await pool.query("SELECT action,actor_id,target_id,request_id,changes FROM auth_audit_events WHERE target_id=$1 ORDER BY occurred_at", [categoryId]);
    assert.deepEqual(events.rows.map(({ action }) => action), ["CATALOG_CATEGORY_CREATED", "CATALOG_CATEGORY_ARCHIVED"]);
    assert.equal(events.rows.every(({ actor_id }) => actor_id === actorId), true);
  } finally { await pool.end(); }
});
