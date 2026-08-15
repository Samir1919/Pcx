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
  if (!pool || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
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
  return Object.freeze({ create, archive });
}
