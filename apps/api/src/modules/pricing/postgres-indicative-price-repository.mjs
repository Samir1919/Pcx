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

function record(row) {
  return Object.freeze({
    id: row.id,
    productModelId: row.product_model_id,
    categoryId: row.category_id,
    lowValue: Number(row.low_value),
    highValue: Number(row.high_value),
    status: row.status,
    setBy: row.set_by,
    createdAt: new Date(row.created_at).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null
  });
}

const columns = "id, product_model_id, category_id, low_value, high_value, status, set_by, created_at, archived_at";

export function createPostgresIndicativePriceRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    // Append-only: archive the current ACTIVE row for the same target, then
    // insert the new ACTIVE row inside one transaction.
    async upsertActive(price) {
      return transaction(pool, async (client) => {
        if (price.productModelId) {
          await client.query(
            "UPDATE indicative_prices SET status = 'ARCHIVED', archived_at = $2 WHERE product_model_id::text = $1 AND status = 'ACTIVE'",
            [price.productModelId, price.createdAt]
          );
        } else {
          await client.query(
            "UPDATE indicative_prices SET status = 'ARCHIVED', archived_at = $2 WHERE category_id::text = $1 AND status = 'ACTIVE'",
            [price.categoryId, price.createdAt]
          );
        }
        const inserted = await client.query(
          `INSERT INTO indicative_prices(id, product_model_id, category_id, low_value, high_value, status, set_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7)
           RETURNING ${columns}`,
          [price.id, price.productModelId, price.categoryId, price.lowValue, price.highValue, price.setBy, price.createdAt]
        );
        return record(inserted.rows[0]);
      });
    },

    async findActiveByProductModel(productModelId) {
      const result = await pool.query(`SELECT ${columns} FROM indicative_prices WHERE product_model_id::text = $1 AND status = 'ACTIVE' LIMIT 1`, [productModelId]);
      return result.rows[0] ? record(result.rows[0]) : null;
    },

    async findActiveByCategory(categoryId) {
      const result = await pool.query(`SELECT ${columns} FROM indicative_prices WHERE category_id::text = $1 AND status = 'ACTIVE' LIMIT 1`, [categoryId]);
      return result.rows[0] ? record(result.rows[0]) : null;
    },

    async list({ limit = 50 } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new TypeError("indicative price limit is invalid");
      const result = await pool.query(`SELECT ${columns} FROM indicative_prices ORDER BY created_at DESC LIMIT $1`, [limit]);
      return result.rows.map(record);
    }
  });
}
