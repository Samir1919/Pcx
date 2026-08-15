async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function template(row) {
  return Object.freeze({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    version: row.version,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString()
  });
}

function item(row) {
  return Object.freeze({
    id: row.id,
    templateId: row.template_id,
    code: row.code,
    label: row.label,
    resultType: row.result_type,
    unit: row.unit,
    isMandatory: row.is_mandatory,
    isCritical: row.is_critical,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString()
  });
}

export function createPostgresInspectionTemplateRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(templateRecord, items) {
      return transaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO inspection_templates(id, category_id, name, version, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, category_id, name, version, status, created_at`,
          [templateRecord.id, templateRecord.categoryId, templateRecord.name, templateRecord.version, templateRecord.status, templateRecord.createdAt]
        );
        const itemRows = [];
        for (const entry of items) {
          const row = await client.query(
            `INSERT INTO inspection_template_items(id, template_id, code, label, result_type, unit, is_mandatory, is_critical, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, template_id, code, label, result_type, unit, is_mandatory, is_critical, sort_order, created_at`,
            [entry.id, templateRecord.id, entry.code, entry.label, entry.resultType, entry.unit, entry.isMandatory, entry.isCritical, entry.sortOrder, entry.createdAt]
          );
          itemRows.push(row.rows[0]);
        }
        return { template: template(inserted.rows[0]), items: itemRows.map(item) };
      });
    },

    async findById(id) {
      const result = await pool.query("SELECT id, category_id, name, version, status, created_at FROM inspection_templates WHERE id::text = $1", [id]);
      return result.rows[0] ? template(result.rows[0]) : null;
    },

    async listByCategory(categoryId) {
      const result = await pool.query("SELECT id, category_id, name, version, status, created_at FROM inspection_templates WHERE category_id::text = $1 AND status = 'ACTIVE' ORDER BY name, version", [categoryId]);
      return result.rows.map(template);
    },

    async listItems(templateId) {
      const result = await pool.query("SELECT id, template_id, code, label, result_type, unit, is_mandatory, is_critical, sort_order, created_at FROM inspection_template_items WHERE template_id::text = $1 ORDER BY sort_order, code", [templateId]);
      return result.rows.map(item);
    }
  });
}
