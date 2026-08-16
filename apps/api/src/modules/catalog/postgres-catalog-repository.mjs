function timestamp(value) { return new Date(value).toISOString(); }

function category(row) {
  return Object.freeze({ id: row.id, parentId: row.parent_id, name: row.name, slug: row.slug, status: row.status, sortOrder: row.sort_order, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at), archivedAt: row.archived_at ? timestamp(row.archived_at) : null });
}
function brand(row) {
  return Object.freeze({ id: row.id, name: row.name, slug: row.slug, status: row.status, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at), archivedAt: row.archived_at ? timestamp(row.archived_at) : null });
}
function model(row) {
  return Object.freeze({ id: row.id, categoryId: row.category_id, brandId: row.brand_id, name: row.name, slug: row.slug, modelCode: row.model_code, searchAliases: Object.freeze([...(row.search_aliases ?? [])]), status: row.status, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at), archivedAt: row.archived_at ? timestamp(row.archived_at) : null });
}

function decodeCursor(value, sort) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("catalog cursor is invalid");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== sort || typeof parsed[1] !== "string" || typeof parsed[2] !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parsed[2])) throw new Error();
    return { name: parsed[1], id: parsed[2] };
  } catch { throw new TypeError("catalog cursor is invalid"); }
}
function encodeCursor(row, sort) { return Buffer.from(JSON.stringify([sort, row.name, row.id])).toString("base64url"); }
function escapedLike(value) { return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`; }

export function createPostgresCatalogRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");
  return Object.freeze({
    async listCategories() {
      const result = await pool.query("SELECT id,parent_id,name,slug,status,sort_order,created_at,updated_at,archived_at FROM categories WHERE status='ACTIVE' ORDER BY sort_order,name,id");
      return result.rows.map(category);
    },
    async listBrands() {
      const result = await pool.query("SELECT id,name,slug,status,created_at,updated_at,archived_at FROM brands WHERE status='ACTIVE' ORDER BY name,id");
      return result.rows.map(brand);
    },
    async listProductModels({ categoryId, brandId, q, cursor, limit = 20, sort = "name_asc" } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !new Set(["name_asc", "name_desc"]).has(sort)) throw new TypeError("catalog filters are invalid");
      const decoded = decodeCursor(cursor, sort);
      const values = [];
      const where = ["status='ACTIVE'"];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (categoryId) where.push(`category_id::text=${add(categoryId)}`);
      if (brandId) where.push(`brand_id::text=${add(brandId)}`);
      if (q) {
        const parameter = add(escapedLike(q));
        where.push(`(name ILIKE ${parameter} ESCAPE '\\' OR COALESCE(model_code,'') ILIKE ${parameter} ESCAPE '\\' OR EXISTS (SELECT 1 FROM unnest(search_aliases) alias WHERE alias ILIKE ${parameter} ESCAPE '\\'))`);
      }
      const descending = sort === "name_desc";
      if (decoded) {
        const name = add(decoded.name);
        const id = add(decoded.id);
        where.push(`(name,id) ${descending ? "<" : ">"} (${name},${id}::uuid)`);
      }
      const pageSize = add(limit + 1);
      const result = await pool.query(`SELECT id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at,updated_at,archived_at FROM product_models WHERE ${where.join(" AND ")} ORDER BY name ${descending ? "DESC" : "ASC"},id ${descending ? "DESC" : "ASC"} LIMIT ${pageSize}`, values);
      const hasNext = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      return { records: rows.map(model), nextCursor: hasNext ? encodeCursor(rows.at(-1), sort) : null };
    },
    async findProductModelById(id) {
      const result = await pool.query("SELECT id,category_id,brand_id,name,slug,model_code,search_aliases,status,created_at,updated_at,archived_at FROM product_models WHERE id::text=$1 AND status='ACTIVE'", [id]);
      return result.rows[0] ? model(result.rows[0]) : null;
    },
    async listModelSpecifications(id) {
      const result = await pool.query(
        `SELECT v.id,v.spec_definition_id,d.key,d.label,v.data_type,d.unit,v.value_text,v.value_number,v.value_boolean,v.value_json
         FROM model_spec_values v
         JOIN spec_definitions d ON d.id=v.spec_definition_id AND d.status='ACTIVE'
         WHERE v.product_model_id::text=$1
         ORDER BY d.sort_order,d.label,d.id`, [id]);
      return result.rows.map((row) => ({
        id: row.id,
        specificationDefinitionId: row.spec_definition_id,
        key: row.key,
        label: row.label,
        dataType: row.data_type,
        unit: row.unit,
        value: row.data_type === "TEXT" ? row.value_text
          : row.data_type === "NUMBER" ? Number(row.value_number)
            : row.data_type === "BOOLEAN" ? row.value_boolean
              : row.value_json
      }));
    }
  });
}
