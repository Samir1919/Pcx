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

function listing(row) {
  return Object.freeze({
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    status: row.status,
    publicSlug: row.public_slug,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    unpublishedAt: row.unpublished_at ? new Date(row.unpublished_at).toISOString() : null,
    warrantyPolicyId: row.warranty_policy_id,
    createdAt: new Date(row.created_at).toISOString()
  });
}

function price(row) {
  return Object.freeze({
    id: row.id,
    listingId: row.listing_id,
    price: Number(row.price),
    validFrom: new Date(row.valid_from).toISOString(),
    validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null,
    reason: row.reason,
    setByUser: row.set_by_user_id
  });
}

export function createPostgresListingRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createDraft(record) {
      const result = await pool.query(
        `INSERT INTO listings(id, inventory_item_id, status, public_slug, warranty_policy_id, created_at)
         VALUES ($1, $2, 'DRAFT', $3, $4, $5)
         RETURNING id, inventory_item_id, status, public_slug, published_at, unpublished_at, warranty_policy_id, created_at`,
        [record.id, record.inventoryItemId, record.publicSlug, record.warrantyPolicyId, record.createdAt]
      );
      return listing(result.rows[0]);
    },

    async publish(listingId, publicSlug, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE listings SET status = 'PUBLISHED', public_slug = $2, published_at = $3
           WHERE id = $1 AND status IN ('DRAFT', 'PAUSED')
           RETURNING id, inventory_item_id, status, public_slug, published_at, unpublished_at, warranty_policy_id, created_at`,
          [listingId, publicSlug, now]
        );
        if (updated.rowCount !== 1) return { status: "not_publishable" };
        return { status: "published", record: listing(updated.rows[0]) };
      });
    },

    async createPrice(record, now) {
      return transaction(pool, async (client) => {
        await client.query("UPDATE listing_prices SET valid_to = $2 WHERE listing_id = $1 AND valid_to IS NULL", [record.listingId, now]);
        const inserted = await client.query(
          `INSERT INTO listing_prices(id, listing_id, price, valid_from, valid_to, reason, set_by_user_id)
           VALUES ($1, $2, $3, $4, NULL, $5, $6)
           RETURNING id, listing_id, price, valid_from, valid_to, reason, set_by_user_id`,
          [record.id, record.listingId, record.price, record.validFrom, record.reason, record.setByUser]
        );
        return price(inserted.rows[0]);
      });
    },

    async findById(id) {
      const result = await pool.query("SELECT id, inventory_item_id, status, public_slug, published_at, unpublished_at, warranty_policy_id, created_at FROM listings WHERE id::text = $1", [id]);
      return result.rows[0] ? listing(result.rows[0]) : null;
    },

    async findPublicPassport(pcxItemId) {
      const result = await pool.query(
        `SELECT ii.pcx_item_id, pm.id AS model_id, pm.name, pm.category_id, pm.brand_id,
                l.status, l.published_at, lp.price
         FROM listings l
         JOIN inventory_items ii ON ii.id = l.inventory_item_id
         JOIN product_models pm ON pm.id = ii.product_model_id
         LEFT JOIN LATERAL (
           SELECT price FROM listing_prices WHERE listing_id = l.id AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1
         ) lp ON true
         WHERE ii.pcx_item_id = $1 AND l.status = 'PUBLISHED'`,
        [pcxItemId]
      );
      return result.rows[0] ?? null;
    }
  });
}
