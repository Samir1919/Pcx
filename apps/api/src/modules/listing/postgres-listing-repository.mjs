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

    async findPublishedByInventoryItem(inventoryItemId) {
      const result = await pool.query(
        "SELECT id, inventory_item_id, status, public_slug, published_at, unpublished_at, warranty_policy_id, created_at FROM listings WHERE inventory_item_id::text = $1 AND status = 'PUBLISHED' LIMIT 1",
        [inventoryItemId]
      );
      return result.rows[0] ? listing(result.rows[0]) : null;
    },

    async findPublicPassport(pcxItemId) {
      const result = await pool.query(
        `SELECT ii.pcx_item_id, ii.id AS inventory_item_id, l.id AS listing_id,
                pm.id AS model_id, pm.name, pm.category_id, pm.brand_id,
                ii.condition_grade, ii.current_health_score,
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
    },

    async listAdmin({ limit = 50, cursor = null } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError("listing admin limit is invalid");
      const values = [];
      const where = [];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        where.push(`(l.created_at, l.id::text) < (${add(decoded.value)}, ${add(decoded.id)})`);
      }
      const pageSize = add(limit + 1);
      const result = await pool.query(
        `SELECT l.id, l.inventory_item_id, l.status, l.public_slug, l.published_at, l.created_at,
                ii.pcx_item_id, pm.id AS model_id, pm.name AS model_name,
                lp.price
         FROM listings l
         JOIN inventory_items ii ON ii.id = l.inventory_item_id
         JOIN product_models pm ON pm.id = ii.product_model_id
         LEFT JOIN LATERAL (
           SELECT price FROM listing_prices WHERE listing_id = l.id AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1
         ) lp ON true
         ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ${pageSize}`,
        values
      );
      const hasNext = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const nextCursor = hasNext
        ? Buffer.from(JSON.stringify({ id: rows.at(-1).id, value: new Date(rows.at(-1).created_at).toISOString() })).toString("base64url")
        : null;
      return { records: rows, nextCursor };
    },

    async searchPublished({ categoryId = null, brandId = null, q = null, limit = 20, cursor = null, sort = "newest" } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !new Set(["newest", "price_asc", "price_desc"]).has(sort)) throw new TypeError("listing search filters are invalid");
      const values = [];
      const where = ["l.status = 'PUBLISHED'"];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (categoryId) where.push(`pm.category_id::text = ${add(categoryId)}`);
      if (brandId) where.push(`pm.brand_id::text = ${add(brandId)}`);
      if (q) {
        const parameter = add(`%${q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
        where.push(`(pm.name ILIKE ${parameter} ESCAPE '\\' OR COALESCE(pm.model_code,'') ILIKE ${parameter} ESCAPE '\\')`);
      }
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (sort === "price_desc") {
          where.push(`(lp.price, l.id::text) < (${add(decoded.value)}, ${add(decoded.id)})`);
        } else if (sort === "price_asc") {
          where.push(`(lp.price, l.id::text) > (${add(decoded.value)}, ${add(decoded.id)})`);
        } else {
          where.push(`(l.published_at, l.id::text) < (${add(decoded.value)}, ${add(decoded.id)})`);
        }
      }
      const orderBy = sort === "price_desc" ? "lp.price DESC NULLS LAST, l.id DESC"
        : sort === "price_asc" ? "lp.price ASC NULLS LAST, l.id ASC"
          : "l.published_at DESC, l.id DESC";
      const pageSize = add(limit + 1);
      const result = await pool.query(
        `SELECT l.id, l.public_slug, ii.id AS inventory_item_id, ii.pcx_item_id, pm.id AS model_id, pm.name, pm.category_id, pm.brand_id,
                ii.condition_grade, ii.current_health_score,
                l.published_at, lp.price
         FROM listings l
         JOIN inventory_items ii ON ii.id = l.inventory_item_id
         JOIN product_models pm ON pm.id = ii.product_model_id
         LEFT JOIN LATERAL (
           SELECT price FROM listing_prices WHERE listing_id = l.id AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1
         ) lp ON true
         WHERE ${where.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT ${pageSize}`,
        values
      );
      const hasNext = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      const nextCursor = hasNext
        ? Buffer.from(JSON.stringify({ id: rows.at(-1).id, value: sort === "newest" ? new Date(rows.at(-1).published_at).toISOString() : (rows.at(-1).price == null ? null : Number(rows.at(-1).price)) })).toString("base64url")
        : null;
      return { records: rows, nextCursor };
    }
  });
}
