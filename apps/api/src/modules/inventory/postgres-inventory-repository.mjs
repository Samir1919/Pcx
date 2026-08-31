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

function item(row) {
  return Object.freeze({
    id: row.id,
    pcxItemId: row.pcx_item_id,
    productModelId: row.product_model_id,
    productName: row.product_name ?? null,
    modelCode: row.model_code ?? null,
    brandName: row.brand_name ?? null,
    categoryName: row.category_name ?? null,
    acquisitionId: row.acquisition_id,
    acquisitionCost: row.acquisition_cost != null ? Number(row.acquisition_cost) : null,
    status: row.status,
    conditionGrade: row.condition_grade ?? null,
    currentHealthScore: row.current_health_score != null ? Number(row.current_health_score) : null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    receivedAt: new Date(row.received_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

function identifier(row) {
  return Object.freeze({
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    identifierType: row.identifier_type,
    valueNormalized: row.value_normalized,
    valueDisplay: row.value_display,
    isPrimary: row.is_primary,
    createdAt: new Date(row.created_at).toISOString()
  });
}

export function createPostgresInventoryRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createWithIdentifiers(record, identifiers, now) {
      return transaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO inventory_items(id, pcx_item_id, product_model_id, acquisition_id, acquisition_cost, status, received_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7)
           RETURNING id, pcx_item_id, product_model_id, acquisition_id, acquisition_cost, status, received_at, created_at, updated_at`,
          [record.id, record.pcxItemId, record.productModelId, record.acquisitionId, record.acquisitionCost, record.status, now]
        );
        const serialRows = [];
        for (const identifier of identifiers) {
          const serial = await client.query(
            `INSERT INTO serial_identifiers(id, inventory_item_id, identifier_type, value_normalized, value_display, is_primary, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, inventory_item_id, identifier_type, value_normalized, value_display, is_primary, created_at`,
            [identifier.id, record.id, identifier.identifierType, identifier.valueNormalized, identifier.valueDisplay, identifier.isPrimary, now]
          );
          serialRows.push(serial.rows[0]);
        }
        return { item: item(inserted.rows[0]), identifiers: serialRows.map(identifier) };
      });
    },

    async findById(id) {
      const result = await pool.query(
        `SELECT ii.id, ii.pcx_item_id, ii.product_model_id, ii.acquisition_id, ii.acquisition_cost,
                ii.status, ii.condition_grade, ii.current_health_score, ii.approved_at,
                ii.received_at, ii.created_at, ii.updated_at,
                pm.name AS product_name, pm.model_code,
                b.name AS brand_name, c.name AS category_name,
                (SELECT si.value_display FROM serial_identifiers si WHERE si.inventory_item_id = ii.id AND si.is_primary = true LIMIT 1) AS serial_value
         FROM inventory_items ii
         JOIN product_models pm ON pm.id = ii.product_model_id
         LEFT JOIN brands b ON b.id = pm.brand_id
         LEFT JOIN categories c ON c.id = pm.category_id
         WHERE ii.id::text = $1`,
        [id]
      );
      const row = result.rows[0];
      return row ? Object.freeze({ ...item(row), serialValue: row.serial_value ?? null }) : null;
    },

    async list() {
      const result = await pool.query(
        `SELECT ii.id, ii.pcx_item_id, ii.product_model_id, ii.acquisition_id, ii.acquisition_cost,
                ii.status, ii.condition_grade, ii.current_health_score, ii.approved_at,
                ii.received_at, ii.created_at, ii.updated_at,
                pm.name AS product_name, pm.model_code,
                b.name AS brand_name, c.name AS category_name
         FROM inventory_items ii
         JOIN product_models pm ON pm.id = ii.product_model_id
         LEFT JOIN brands b ON b.id = pm.brand_id
         LEFT JOIN categories c ON c.id = pm.category_id
         ORDER BY ii.received_at DESC`
      );
      return result.rows.map(item);
    }
  });
}
