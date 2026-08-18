function listing(row) {
  return Object.freeze({
    id: row.id,
    ownerUserId: row.owner_user_id,
    inventoryItemId: row.inventory_item_id,
    productModelId: row.product_model_id,
    status: row.status,
    publicSlug: row.public_slug,
    proposedPrice: row.proposed_price == null ? null : Number(row.proposed_price),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  });
}

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

export function createMerchantListingRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createDraft({ id, ownerUserId, productModelId, proposedPrice = null, createdAt }) {
      const result = await pool.query(
        `INSERT INTO listings(id, owner_user_id, product_model_id, status, proposed_price, created_at)
         VALUES ($1, $2, $3, 'DRAFT', $4, $5)
         RETURNING id, owner_user_id, inventory_item_id, product_model_id, status, public_slug, proposed_price, published_at, created_at`,
        [id, ownerUserId, productModelId, proposedPrice, createdAt]
      );
      return listing(result.rows[0]);
    },

    async findOwnedById(id) {
      const result = await pool.query(
        `SELECT id, owner_user_id, inventory_item_id, product_model_id, status, public_slug, proposed_price, published_at, created_at
         FROM listings WHERE id::text = $1`,
        [id]
      );
      return result.rows[0] ? listing(result.rows[0]) : null;
    },

    async listForOwner(ownerUserId, { limit = 50, cursor = null } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError("limit is invalid");
      const values = [ownerUserId];
      const where = ["l.owner_user_id::text = $1"];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        where.push(`(l.created_at, l.id::text) < (${add(decoded.createdAt)}, ${add(decoded.id)})`);
      }
      const pageSize = add(limit + 1);
      const result = await pool.query(
        `SELECT l.id, l.owner_user_id, l.inventory_item_id, l.product_model_id, l.status, l.public_slug, l.proposed_price, l.published_at, l.created_at,
                pm.name AS model_name, pm.category_id, pm.brand_id
         FROM listings l
         LEFT JOIN product_models pm ON pm.id = l.product_model_id
         WHERE ${where.join(" AND ")}
         ORDER BY l.created_at DESC, l.id::text DESC
         LIMIT ${pageSize}`,
        values
      );
      const hasNext = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const nextCursor = hasNext && rows.length > 0
        ? Buffer.from(JSON.stringify({ id: rows.at(-1).id, createdAt: new Date(rows.at(-1).created_at).toISOString() })).toString("base64url")
        : null;
      return {
        rows: rows.map((row) => Object.freeze({ ...listing(row), modelName: row.model_name, categoryId: row.category_id, brandId: row.brand_id })),
        nextCursor
      };
    },

    async updateDraft({ id, ownerUserId, productModelId, proposedPrice, now }) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE listings
           SET product_model_id = $3, proposed_price = $4, updated_at = $5
           WHERE id::text = $1 AND owner_user_id::text = $2 AND status = 'DRAFT'
           RETURNING id, owner_user_id, inventory_item_id, product_model_id, status, public_slug, proposed_price, published_at, created_at`,
          [id, ownerUserId, productModelId, proposedPrice, now]
        );
        return updated.rowCount === 1 ? listing(updated.rows[0]) : null;
      });
    },

    async archiveDraft({ id, ownerUserId, now }) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE listings SET status = 'ARCHIVED', updated_at = $3
           WHERE id::text = $1 AND owner_user_id::text = $2 AND status = 'DRAFT'
           RETURNING id, owner_user_id, inventory_item_id, product_model_id, status, public_slug, proposed_price, published_at, created_at`,
          [id, ownerUserId, now]
        );
        return updated.rowCount === 1 ? listing(updated.rows[0]) : null;
      });
    }
  });
}
