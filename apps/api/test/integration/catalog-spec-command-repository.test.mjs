import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresCatalogSpecCommandRepository } from "../../src/modules/catalog/postgres-catalog-spec-command-repository.mjs";

const connectionString=process.env.TEST_DATABASE_URL;
test("spec commands persist typed values and actor audits atomically",{skip:!connectionString},async()=>{
  await runMigrations({connectionString}); const pool=new pg.Pool({connectionString}); const repo=createPostgresCatalogSpecCommandRepository({pool});
  const actor="76000000-0000-4000-8000-000000000001",category="76000000-0000-4000-8000-000000000002",brand="76000000-0000-4000-8000-000000000003",model="76000000-0000-4000-8000-000000000004",definition="76000000-0000-4000-8000-000000000005",value="76000000-0000-4000-8000-000000000006",now="2026-08-16T00:00:00.000Z";
  const event=(id,action,targetId)=>({id,actorId:actor,action,targetType:"SPEC",targetId,requestId:"spec-test",changes:{action},occurredAt:now});
  try{
    await pool.query("DELETE FROM auth_audit_events WHERE actor_id=$1",[actor]); await pool.query("DELETE FROM model_spec_values WHERE product_model_id=$1",[model]); await pool.query("DELETE FROM spec_definitions WHERE id=$1",[definition]); await pool.query("DELETE FROM product_models WHERE id=$1",[model]); await pool.query("DELETE FROM brands WHERE id=$1",[brand]); await pool.query("DELETE FROM categories WHERE id=$1",[category]); await pool.query("DELETE FROM users WHERE id=$1",[actor]);
    await pool.query("INSERT INTO users(id,email,status,contact_verified) VALUES ($1,'spec-admin@example.com','ACTIVE',true)",[actor]);
    await pool.query("INSERT INTO categories(id,name,slug,status) VALUES ($1,'Spec Test','spec-test','ACTIVE')",[category]);
    await pool.query("INSERT INTO brands(id,name,slug,status) VALUES ($1,'Spec Brand','spec-brand','ACTIVE')",[brand]);
    await pool.query("INSERT INTO product_models(id,category_id,brand_id,name,slug,status) VALUES ($1,$2,$3,'Spec Model','spec-model','ACTIVE')",[model,category,brand]);
    const record={id:definition,categoryId:category,key:"capacity_gb",label:"Capacity",dataType:"NUMBER",unit:"GB",filterable:true,required:false,sortOrder:1,status:"ACTIVE",createdAt:now};
    await repo.createDefinition(record,event("76000000-0000-4000-8000-000000000007","CREATE",definition)); assert.equal((await repo.findDefinition(definition)).dataType,"NUMBER");
    let saved=await repo.upsertValue({id:value,productModelId:model,specificationDefinitionId:definition,dataType:"NUMBER",value:256,createdAt:now},category,event("76000000-0000-4000-8000-000000000008","UPSERT",value)); assert.equal(saved.value,256);
    saved=await repo.upsertValue({...saved,value:512},category,event("76000000-0000-4000-8000-000000000009","UPSERT",value)); assert.equal(saved.id,value);
    assert.equal(Number((await pool.query("SELECT value_number FROM model_spec_values WHERE id=$1",[value])).rows[0].value_number),512);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM auth_audit_events WHERE actor_id=$1",[actor])).rows[0].count,3);
  }finally{await pool.end();}
});
