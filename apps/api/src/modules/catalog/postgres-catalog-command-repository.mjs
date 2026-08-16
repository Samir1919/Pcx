async function transaction(pool, operation) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function audit(client, { id, actorId, action, targetType, targetId, requestId, changes, occurredAt }) {
  await client.query("INSERT INTO auth_audit_events(id,actor_id,action,target_type,target_id,request_id,changes,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)", [id, actorId, action, targetType, targetId, requestId, JSON.stringify(changes), occurredAt]);
}

export function createPostgresCatalogCommandRepository({ pool }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");
  async function create(record, kind, auditEvent) {
    const definitions = {
      category: ["INSERT INTO categories(id,parent_id,name,slug,status,sort_order,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)", [record.id, record.parentId, record.name, record.slug, record.status, record.sortOrder, record.createdAt]],
      brand: ["INSERT INTO brands(id,name,slug,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)", [record.id, record.name, record.slug, record.status, record.createdAt]],
      product_model: ["INSERT INTO product_models(id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)", [record.id, record.categoryId, record.brandId, record.name, record.slug, record.modelCode, record.searchAliases, record.status, record.createdAt]]
    };
    if (!definitions[kind]) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => { await client.query(...definitions[kind]); await audit(client, auditEvent); return record; });
  }
  async function archive(id, kind, archivedAt, auditEvent) {
    const tables = { category: "categories", brand: "brands", product_model: "product_models" };
    const table = tables[kind];
    if (!table) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => {
      const result = await client.query(`UPDATE ${table} SET status='ARCHIVED',archived_at=COALESCE(archived_at,$2),updated_at=$2 WHERE id::text=$1 AND status='ACTIVE' RETURNING id`, [id, archivedAt]);
      if (result.rowCount !== 1) return false;
      await audit(client, auditEvent);
      return true;
    });
  }
  async function find(kind, id) {
    const selections = {
      category: ["SELECT id,parent_id,name,slug,status,sort_order,created_at FROM categories WHERE id::text=$1 AND status='ACTIVE'", (row) => ({ id: row.id, parentId: row.parent_id, name: row.name, slug: row.slug, status: row.status, sortOrder: row.sort_order, createdAt: new Date(row.created_at).toISOString() })],
      brand: ["SELECT id,name,slug,status,created_at FROM brands WHERE id::text=$1 AND status='ACTIVE'", (row) => ({ id: row.id, name: row.name, slug: row.slug, status: row.status, createdAt: new Date(row.created_at).toISOString() })],
      product_model: ["SELECT id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at FROM product_models WHERE id::text=$1 AND status='ACTIVE'", (row) => ({ id: row.id, categoryId: row.category_id, brandId: row.brand_id, name: row.name, slug: row.slug, modelCode: row.model_code, searchAliases: row.search_aliases, status: row.status, createdAt: new Date(row.created_at).toISOString() })]
    };
    if (!selections[kind]) throw new TypeError("catalog kind is invalid");
    const result = await pool.query(selections[kind][0], [id]);
    return result.rows[0] ? selections[kind][1](result.rows[0]) : null;
  }
  async function update(record, kind, updatedAt, auditEvent) {
    const definitions = {
      category: ["UPDATE categories SET parent_id=$2,name=$3,slug=$4,sort_order=$5,updated_at=$6 WHERE id=$1 AND status='ACTIVE'", [record.id,record.parentId,record.name,record.slug,record.sortOrder,updatedAt]],
      brand: ["UPDATE brands SET name=$2,slug=$3,updated_at=$4 WHERE id=$1 AND status='ACTIVE'", [record.id,record.name,record.slug,updatedAt]],
      product_model: ["UPDATE product_models SET category_id=$2,brand_id=$3,name=$4,slug=$5,model_code=$6,search_aliases=$7,updated_at=$8 WHERE id=$1 AND status='ACTIVE'", [record.id,record.categoryId,record.brandId,record.name,record.slug,record.modelCode,record.searchAliases,updatedAt]]
    };
    if (!definitions[kind]) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => { const result=await client.query(...definitions[kind]); if(result.rowCount!==1)return false; await audit(client,auditEvent); return true; });
  }
  return Object.freeze({ create, find, update, archive });
}
