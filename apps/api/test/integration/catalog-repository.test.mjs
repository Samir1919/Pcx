import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresCatalogRepository } from "../../src/modules/catalog/postgres-catalog-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("catalog persistence enforces typed category alignment and deterministic public reads", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresCatalogRepository({ pool });
  const categoryA = "70000000-0000-0000-0000-000000000001";
  const categoryB = "70000000-0000-0000-0000-000000000002";
  const brandId = "71000000-0000-0000-0000-000000000001";
  const modelA = "72000000-0000-0000-0000-000000000001";
  const modelB = "72000000-0000-0000-0000-000000000002";
  const archived = "72000000-0000-0000-0000-000000000003";
  const definitionA = "73000000-0000-0000-0000-000000000001";
  const definitionB = "73000000-0000-0000-0000-000000000002";
  try {
    await pool.query("DELETE FROM model_spec_values WHERE product_model_id IN ($1,$2,$3)", [modelA, modelB, archived]);
    await pool.query("DELETE FROM indicative_prices WHERE category_id IN ($1,$2) OR product_model_id IN ($3,$4,$5)", [categoryA, categoryB, modelA, modelB, archived]);
    await pool.query("DELETE FROM spec_definitions WHERE category_id IN ($1,$2)", [categoryA, categoryB]);
    await pool.query("DELETE FROM product_models WHERE id IN ($1,$2,$3)", [modelA, modelB, archived]);
    await pool.query("DELETE FROM brands WHERE id=$1", [brandId]);
    await pool.query("DELETE FROM categories WHERE id IN ($1,$2)", [categoryA, categoryB]);
    await pool.query("INSERT INTO categories(id,name,slug,status,sort_order) VALUES ($1,'GPU','gpu-test','ACTIVE',1),($2,'CPU','cpu-test','ACTIVE',2)", [categoryA, categoryB]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'PCX Test','pcx-test','ACTIVE')", [brandId]);
    await pool.query("INSERT INTO product_models(id,category_id,brand_id,name,slug,model_code,search_aliases,status,archived_at) VALUES ($1,$4,$5,'Alpha','alpha-test','A1',ARRAY['first'],'ACTIVE',NULL),($2,$4,$5,'Beta','beta-test','B1',ARRAY['second'],'ACTIVE',NULL),($3,$4,$5,'Hidden','hidden-test',NULL,'{}','ARCHIVED',now())", [modelA, modelB, archived, categoryA, brandId]);
    await pool.query("INSERT INTO spec_definitions(id,category_id,key,label,data_type,status) VALUES ($1,$3,'memory_gb','Memory','NUMBER','ACTIVE'),($2,$4,'socket','Socket','TEXT','ACTIVE')", [definitionA, definitionB, categoryA, categoryB]);
    await pool.query("INSERT INTO model_spec_values(id,product_model_id,spec_definition_id,category_id,data_type,value_number) VALUES ('74000000-0000-0000-0000-000000000001',$1,$2,$3,'NUMBER',8)", [modelA, definitionA, categoryA]);
    await assert.rejects(pool.query("INSERT INTO model_spec_values(id,product_model_id,spec_definition_id,category_id,data_type,value_text) VALUES ('74000000-0000-0000-0000-000000000002',$1,$2,$3,'TEXT','bad')", [modelA, definitionB, categoryA]), (error) => error.code === "23503");
    await assert.rejects(pool.query("INSERT INTO model_spec_values(id,product_model_id,spec_definition_id,category_id,data_type,value_text) VALUES ('74000000-0000-0000-0000-000000000003',$1,$2,$3,'NUMBER','bad')", [modelA, definitionA, categoryA]), (error) => error.code === "23514");

    assert.deepEqual((await repository.listCategories()).filter(({ id }) => id === categoryA || id === categoryB).map(({ id }) => id).sort(), [categoryA, categoryB]);
    assert.deepEqual((await repository.listBrands()).filter(({ id }) => id === brandId).map(({ id }) => id), [brandId]);
    const first = await repository.listProductModels({ categoryId: categoryA, limit: 1, sort: "name_asc" });
    assert.equal(first.records[0].name, "Alpha");
    assert.ok(first.nextCursor);
    const second = await repository.listProductModels({ categoryId: categoryA, limit: 1, sort: "name_asc", cursor: first.nextCursor });
    assert.equal(second.records[0].name, "Beta");
    assert.equal(second.nextCursor, null);
    assert.deepEqual((await repository.listProductModels({ q: "second", limit: 20, sort: "name_asc" })).records.map(({ name }) => name), ["Beta"]);
    assert.equal((await repository.listProductModels({ q: "%", limit: 20, sort: "name_asc" })).records.length, 0);
    assert.equal((await repository.findProductModelById(archived)), null);
    assert.equal((await repository.findProductModelById(modelA)).searchAliases[0], "first");
    const specifications = await repository.listModelSpecifications(modelA);
    assert.deepEqual(specifications.map(({ key, dataType, value }) => [key, dataType, value]), [["memory_gb", "NUMBER", 8]]);
    assert.deepEqual(await repository.listModelSpecifications(modelB), []);
    await assert.rejects(repository.listProductModels({ cursor: "not+base64", limit: 20, sort: "name_asc" }), /cursor/);
    const tampered = Buffer.from(JSON.stringify(["name_asc", "Alpha", "not-a-uuid"])).toString("base64url");
    await assert.rejects(repository.listProductModels({ cursor: tampered, limit: 20, sort: "name_asc" }), /cursor/);
  } finally { await pool.end(); }
});
