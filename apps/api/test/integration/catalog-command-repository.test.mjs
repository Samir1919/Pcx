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
    await pool.query("DELETE FROM auth_audit_events WHERE id IN ('75000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000004','75000000-0000-0000-0000-000000000006')");
    await pool.query("DELETE FROM categories WHERE id=$1", [categoryId]);
    await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    await pool.query("INSERT INTO users(id,email,status,contact_verified) VALUES ($1,'catalog-admin@example.com','ACTIVE',true)", [actorId]);
    const record = { id: categoryId, parentId: null, name: "Admin GPU", slug: "admin-gpu", status: "ACTIVE", sortOrder: 0, createdAt };
    const createdAudit = { id: "75000000-0000-0000-0000-000000000003", actorId, action: "CATALOG_CATEGORY_CREATED", targetType: "CATEGORY", targetId: categoryId, requestId: "create-request", changes: { status: "ACTIVE" }, occurredAt: createdAt };
    await repository.create(record, "category", createdAudit);
    const found=await repository.find("category",categoryId);
    assert.equal(found.name,"Admin GPU");
    const updateAudit={...createdAudit,id:"75000000-0000-0000-0000-000000000006",action:"CATALOG_CATEGORY_UPDATED",requestId:"update-request",occurredAt:"2026-08-16T00:00:30.000Z"};
    assert.equal(await repository.update({...record,name:"Updated GPU"},"category",updateAudit.occurredAt,updateAudit),true);
    const archivedAudit = { ...createdAudit, id: "75000000-0000-0000-0000-000000000004", action: "CATALOG_CATEGORY_ARCHIVED", requestId: "archive-request", changes: { status: "ARCHIVED" }, occurredAt: "2026-08-16T00:01:00.000Z" };
    assert.equal(await repository.archive(categoryId, "category", archivedAudit.occurredAt, archivedAudit), true);
    assert.equal(await repository.archive(categoryId, "category", archivedAudit.occurredAt, { ...archivedAudit, id: "75000000-0000-0000-0000-000000000005" }), false);
    const state = await pool.query("SELECT status,archived_at FROM categories WHERE id=$1", [categoryId]);
    assert.equal(state.rows[0].status, "ARCHIVED");
    assert.ok(state.rows[0].archived_at);
    const events = await pool.query("SELECT action,actor_id,target_id,request_id,changes FROM auth_audit_events WHERE target_id=$1 ORDER BY occurred_at", [categoryId]);
    assert.deepEqual(events.rows.map(({ action }) => action), ["CATALOG_CATEGORY_CREATED", "CATALOG_CATEGORY_UPDATED", "CATALOG_CATEGORY_ARCHIVED"]);
    assert.equal(events.rows.every(({ actor_id }) => actor_id === actorId), true);
  } finally { await pool.end(); }
});

test("catalog admin model list includes INACTIVE models for reactivation", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresCatalogCommandRepository({ pool });
  const categoryId = "77000000-0000-0000-0000-000000000001";
  const brandId = "77000000-0000-0000-0000-000000000002";
  const activeId = "77000000-0000-0000-0000-000000000003";
  const inactiveId = "77000000-0000-0000-0000-000000000004";
  try {
    await pool.query("DELETE FROM product_models WHERE id IN ($1,$2)", [activeId, inactiveId]);
    await pool.query("DELETE FROM brands WHERE id=$1", [brandId]);
    await pool.query("DELETE FROM categories WHERE id=$1", [categoryId]);
    await pool.query("INSERT INTO categories(id,name,slug,status) VALUES ($1,'Admin Models','admin-models','ACTIVE')", [categoryId]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'Admin Brand','admin-brand','ACTIVE')", [brandId]);
    await pool.query("INSERT INTO product_models(id,category_id,brand_id,name,slug,status) VALUES ($1,$3,$4,'Active Model','active-model','ACTIVE'),($2,$3,$4,'Inactive Model','inactive-model','INACTIVE')", [activeId, inactiveId, categoryId, brandId]);
    const result = await repository.listProductModelsAdmin({ limit: 50, sort: "name_asc" });
    const names = result.records.map(({ name }) => name).sort();
    assert.deepEqual(names, ["Active Model", "Inactive Model"]);
    assert.equal(result.records.find(({ id }) => id === inactiveId).status, "INACTIVE");
    assert.equal(result.nextCursor, null);
  } finally {
    await pool.query("DELETE FROM product_models WHERE id IN ($1,$2)", [activeId, inactiveId]);
    await pool.query("DELETE FROM brands WHERE id=$1", [brandId]);
    await pool.query("DELETE FROM categories WHERE id=$1", [categoryId]);
    await pool.end();
  }
});

test("catalog remove hard-deletes unreferenced rows and reports in_use for referenced", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresCatalogCommandRepository({ pool });
  const actorId = "76000000-0000-0000-0000-000000000009";
  const catFree = "76000000-0000-0000-0000-000000000001";
  const catUsed = "76000000-0000-0000-0000-000000000002";
  const brandId = "76000000-0000-0000-0000-000000000003";
  const modelId = "76000000-0000-0000-0000-000000000004";
  const now = "2026-08-16T00:00:00.000Z";
  const audit = (id, targetId) => ({ id, actorId, action: "CATALOG_CATEGORY_DELETED", targetType: "CATEGORY", targetId, requestId: "purge", changes: { status: "DELETED" }, occurredAt: now });
  try {
    await pool.query("DELETE FROM auth_audit_events WHERE actor_id=$1", [actorId]);
    await pool.query("DELETE FROM product_models WHERE id=$1", [modelId]);
    await pool.query("DELETE FROM brands WHERE id=$1", [brandId]);
    await pool.query("DELETE FROM categories WHERE id IN ($1,$2)", [catFree, catUsed]);
    await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    await pool.query("INSERT INTO users(id,email,status,contact_verified) VALUES ($1,'catalog-delete@example.com','ACTIVE',true)", [actorId]);
    await pool.query("INSERT INTO categories(id,name,slug,status) VALUES ($1,'Free','free-test','ACTIVE'),($2,'Used','used-test','ACTIVE')", [catFree, catUsed]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'B','b-test','ACTIVE')", [brandId]);
    await pool.query("INSERT INTO product_models(id,category_id,brand_id,name,slug,status) VALUES ($1,$2,$3,'M','m-test','ACTIVE')", [modelId, catUsed, brandId]);

    assert.deepEqual(await repository.remove(catUsed, "category", audit("76000000-0000-0000-0000-000000000005", catUsed)), { status: "in_use" });
    assert.deepEqual(await repository.remove(catFree, "category", audit("76000000-0000-0000-0000-000000000006", catFree)), { status: "deleted" });
    assert.deepEqual(await repository.remove(catFree, "category", audit("76000000-0000-0000-0000-000000000007", catFree)), { status: "not_found" });

    const deletedEvents = await pool.query("SELECT action FROM auth_audit_events WHERE target_id=$1", [catFree]);
    assert.deepEqual(deletedEvents.rows.map(({ action }) => action), ["CATALOG_CATEGORY_DELETED"]);
  } finally {
    await pool.query("DELETE FROM product_models WHERE id=$1", [modelId]);
    await pool.query("DELETE FROM brands WHERE id=$1", [brandId]);
    await pool.query("DELETE FROM categories WHERE id IN ($1,$2)", [catFree, catUsed]);
    await pool.query("DELETE FROM auth_audit_events WHERE actor_id=$1", [actorId]);
    await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    await pool.end();
  }
});
