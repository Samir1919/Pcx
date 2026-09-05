async function transaction(pool, operation) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function audit(client, { id, actorId, action, targetType, targetId, requestId, changes, occurredAt }) {
  await client.query("INSERT INTO auth_audit_events(id,actor_id,action,target_type,target_id,request_id,changes,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)", [id, actorId, action, targetType, targetId, requestId, JSON.stringify(changes), occurredAt]);
}

function timestamp(value) { return new Date(value).toISOString(); }

function adminModel(row) {
  return Object.freeze({
    id: row.id,
    categoryId: row.category_id,
    brandId: row.brand_id,
    name: row.name,
    slug: row.slug,
    modelCode: row.model_code,
    searchAliases: Object.freeze([...(row.search_aliases ?? [])]),
    status: row.status,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at)
  });
}

function decodeAdminCursor(value, sort) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("catalog cursor is invalid");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== sort || typeof parsed[1] !== "string" || typeof parsed[2] !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parsed[2])) throw new Error();
    return { name: parsed[1], id: parsed[2] };
  } catch { throw new TypeError("catalog cursor is invalid"); }
}
function encodeAdminCursor(row, sort) { return Buffer.from(JSON.stringify([sort, row.name, row.id])).toString("base64url"); }

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
      const result = await client.query(`UPDATE ${table} SET status='ARCHIVED',archived_at=COALESCE(archived_at,$2),updated_at=$2 WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE') RETURNING id`, [id, archivedAt]);
      if (result.rowCount !== 1) return false;
      await audit(client, auditEvent);
      return true;
    });
  }
  // Visibility toggle (ACTIVE ↔ INACTIVE) — reversible and never touches
  // archived_at. Archived rows are intentionally unreachable from this path.
  async function setStatus(id, kind, status, updatedAt, auditEvent) {
    const tables = { category: "categories", brand: "brands", product_model: "product_models" };
    const table = tables[kind];
    if (!table) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => {
      const result = await client.query(`UPDATE ${table} SET status=$2,updated_at=$3 WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE') RETURNING id`, [id, status, updatedAt]);
      if (result.rowCount !== 1) return false;
      await audit(client, auditEvent);
      return true;
    });
  }
  // Hard delete for unreferenced records. A referenced record trips the FK
  // (ON DELETE RESTRICT) and is reported as "in_use" — never cascaded. The
  // savepoint keeps the transaction valid so the caller can still COMMIT/audit.
  async function remove(id, kind, auditEvent) {
    const tables = { category: "categories", brand: "brands", product_model: "product_models" };
    const table = tables[kind];
    if (!table) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => {
      await client.query("SAVEPOINT catalog_remove");
      try {
        const result = await client.query(`DELETE FROM ${table} WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE') RETURNING id`, [id]);
        await client.query("RELEASE SAVEPOINT catalog_remove");
        if (result.rowCount !== 1) return { status: "not_found" };
        await audit(client, auditEvent);
        return { status: "deleted" };
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT catalog_remove");
        await client.query("RELEASE SAVEPOINT catalog_remove");
        if (error?.code === "23503") return { status: "in_use" };
        throw error;
      }
    });
  }
  async function find(kind, id) {
    const selections = {
      category: ["SELECT id,parent_id,name,slug,status,sort_order,created_at FROM categories WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE')", (row) => ({ id: row.id, parentId: row.parent_id, name: row.name, slug: row.slug, status: row.status, sortOrder: row.sort_order, createdAt: new Date(row.created_at).toISOString() })],
      brand: ["SELECT id,name,slug,status,created_at FROM brands WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE')", (row) => ({ id: row.id, name: row.name, slug: row.slug, status: row.status, createdAt: new Date(row.created_at).toISOString() })],
      product_model: ["SELECT id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at FROM product_models WHERE id::text=$1 AND status IN ('ACTIVE','INACTIVE')", (row) => ({ id: row.id, categoryId: row.category_id, brandId: row.brand_id, name: row.name, slug: row.slug, modelCode: row.model_code, searchAliases: row.search_aliases, status: row.status, createdAt: new Date(row.created_at).toISOString() })]
    };
    if (!selections[kind]) throw new TypeError("catalog kind is invalid");
    const result = await pool.query(selections[kind][0], [id]);
    return result.rows[0] ? selections[kind][1](result.rows[0]) : null;
  }
  async function update(record, kind, updatedAt, auditEvent) {
    const definitions = {
      category: ["UPDATE categories SET parent_id=$2,name=$3,slug=$4,sort_order=$5,updated_at=$6 WHERE id=$1 AND status IN ('ACTIVE','INACTIVE')", [record.id,record.parentId,record.name,record.slug,record.sortOrder,updatedAt]],
      brand: ["UPDATE brands SET name=$2,slug=$3,updated_at=$4 WHERE id=$1 AND status IN ('ACTIVE','INACTIVE')", [record.id,record.name,record.slug,updatedAt]],
      product_model: ["UPDATE product_models SET category_id=$2,brand_id=$3,name=$4,slug=$5,model_code=$6,search_aliases=$7,updated_at=$8 WHERE id=$1 AND status IN ('ACTIVE','INACTIVE')", [record.id,record.categoryId,record.brandId,record.name,record.slug,record.modelCode,record.searchAliases,updatedAt]]
    };
    if (!definitions[kind]) throw new TypeError("catalog kind is invalid");
    return transaction(pool, async (client) => { const result=await client.query(...definitions[kind]); if(result.rowCount!==1)return false; await audit(client,auditEvent); return true; });
  }
  // Admin list of categories including INACTIVE (but never ARCHIVED) so a
  // deactivated category can be found and reactivated.
  async function listCategories() {
    const result = await pool.query("SELECT id,parent_id,name,slug,status,sort_order,created_at,updated_at FROM categories WHERE status IN ('ACTIVE','INACTIVE') ORDER BY sort_order,name,id");
    return result.rows.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, slug: row.slug, status: row.status, sortOrder: row.sort_order, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }));
  }
  // Admin list of product models including INACTIVE (but never ARCHIVED) so a
  // deactivated model can be found and reactivated. Mirrors the public list's
  // cursor contract but widens the status filter.
  async function listProductModelsAdmin({ cursor, limit = 50, sort = "name_asc" } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !new Set(["name_asc", "name_desc"]).has(sort)) throw new TypeError("catalog filters are invalid");
    const decoded = decodeAdminCursor(cursor, sort);
    const values = [limit + 1];
    const where = ["status IN ('ACTIVE','INACTIVE')"];
    const descending = sort === "name_desc";
    if (decoded) {
      values.push(decoded.name, decoded.id);
      where.push(`(name,id) ${descending ? "<" : ">"} ($${values.length - 1},$${values.length}::uuid)`);
    }
    const result = await pool.query(`SELECT id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at,updated_at FROM product_models WHERE ${where.join(" AND ")} ORDER BY name ${descending ? "DESC" : "ASC"},id ${descending ? "DESC" : "ASC"} LIMIT $1`, values);
    const hasNext = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    return { records: rows.map(adminModel), nextCursor: hasNext ? encodeAdminCursor(rows.at(-1), sort) : null };
  }
  return Object.freeze({ create, find, update, archive, setStatus, listCategories, listProductModelsAdmin, remove });
}
