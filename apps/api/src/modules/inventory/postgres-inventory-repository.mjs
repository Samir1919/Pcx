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
    acquisitionId: row.acquisition_id,
    status: row.status,
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
          `INSERT INTO inventory_items(id, pcx_item_id, product_model_id, acquisition_id, status, received_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6, $6)
           RETURNING id, pcx_item_id, product_model_id, acquisition_id, status, received_at, created_at, updated_at`,
          [record.id, record.pcxItemId, record.productModelId, record.acquisitionId, record.status, now]
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
        "SELECT id, pcx_item_id, product_model_id, acquisition_id, status, received_at, created_at, updated_at FROM inventory_items WHERE id::text = $1",
        [id]
      );
      return result.rows[0] ? item(result.rows[0]) : null;
    },

    async list() {
      const result = await pool.query(
        "SELECT id, pcx_item_id, product_model_id, acquisition_id, status, received_at, created_at, updated_at FROM inventory_items ORDER BY received_at DESC"
      );
      return result.rows.map(item);
    }
  });
}
