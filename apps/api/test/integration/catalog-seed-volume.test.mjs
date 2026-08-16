import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresCatalogRepository } from "../../src/modules/catalog/postgres-catalog-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("launch catalog seeds are complete, idempotent, safe, and queryable at realistic volume", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresCatalogRepository({ pool });
  const volumeCategory = "86000000-0000-0000-0000-000000000001";
  const volumeBrand = "86000000-0000-0000-0000-000000000002";
  try {
    const categories = await pool.query("SELECT slug FROM categories WHERE id::text LIKE '80000000-%' ORDER BY sort_order");
    assert.deepEqual(categories.rows.map(({ slug }) => slug), ["desktop-pc","laptop","gpu","cpu","motherboard","ram","storage","psu","monitor","accessory"]);
    assert.equal((await pool.query("SELECT count(*)::int count FROM brands WHERE id::text LIKE '81000000-%'")).rows[0].count, 14);
    assert.equal((await pool.query("SELECT count(*)::int count FROM product_models WHERE id::text LIKE '82000000-%'")).rows[0].count, 20);
    assert.equal((await pool.query("SELECT count(*)::int count FROM spec_definitions WHERE id::text LIKE '83000000-%'")).rows[0].count, 8);
    assert.equal((await pool.query("SELECT count(*)::int count FROM model_spec_values WHERE id::text LIKE '84000000-%'")).rows[0].count, 9);
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='product_models'");
    for (const forbidden of ["serial","health_score","acquisition_cost","price","warranty"]) assert.equal(columns.rows.some(({ column_name }) => column_name.includes(forbidden)), false);

    await pool.query("DELETE FROM product_models WHERE id::text LIKE '85000000-%'");
    await pool.query("DELETE FROM brands WHERE id=$1", [volumeBrand]);
    await pool.query("DELETE FROM categories WHERE id=$1", [volumeCategory]);
    await pool.query("INSERT INTO categories(id,name,slug,status,sort_order) VALUES ($1,'Volume Test','volume-test','ACTIVE',999)", [volumeCategory]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'Volume Brand','volume-brand','ACTIVE')", [volumeBrand]);
    await pool.query(`INSERT INTO product_models(id,category_id,brand_id,name,slug,search_aliases,status)
      SELECT ('85000000-0000-0000-0000-' || lpad(to_hex(value),12,'0'))::uuid,$1,$2,
             'Volume Model ' || lpad(value::text,4,'0'),'volume-model-' || value,ARRAY['volume alias ' || value],'ACTIVE'
      FROM generate_series(1,500) value`, [volumeCategory, volumeBrand]);
    await pool.query("ANALYZE product_models");
    const plan = await pool.query("EXPLAIN (FORMAT JSON) SELECT id FROM product_models WHERE status='ACTIVE' ORDER BY name,id LIMIT 50");
    const serializedPlan = JSON.stringify(plan.rows[0]["QUERY PLAN"]);
    assert.match(serializedPlan, /product_models_public_order_idx/);
    assert.equal(serializedPlan.includes("Seq Scan"), false);

    let cursor = null;
    const volumeIds = new Set();
    do {
      const page = await repository.listProductModels({ cursor, limit: 50, sort: "name_asc" });
      for (const model of page.records) if (model.categoryId === volumeCategory) volumeIds.add(model.id);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(volumeIds.size, 500);
    const found = await repository.listProductModels({ q: "volume alias 499", limit: 20, sort: "name_asc" });
    assert.equal(found.records.some(({ name }) => name === "Volume Model 0499"), true);
  } finally { await pool.end(); }
});
