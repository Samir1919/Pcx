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

function cart(row) {
  return Object.freeze({
    id: row.id,
    userId: row.user_id,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

function item(row) {
  return Object.freeze({
    id: row.id,
    cartId: row.cart_id,
    inventoryItemId: row.inventory_item_id,
    listingId: row.listing_id,
    priceSnapshot: row.price_snapshot == null ? null : Number(row.price_snapshot)
  });
}

export function createPostgresCartRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async findActiveByUser(userId) {
      const result = await pool.query(
        "SELECT id, user_id, status, created_at, updated_at FROM carts WHERE user_id::text = $1 AND status = 'ACTIVE' LIMIT 1",
        [userId]
      );
      return result.rows[0] ? cart(result.rows[0]) : null;
    },

    async createCart(record, now) {
      const result = await pool.query(
        `INSERT INTO carts(id, user_id, status, created_at, updated_at)
         VALUES ($1, $2, 'ACTIVE', $3, $3)
         RETURNING id, user_id, status, created_at, updated_at`,
        [record.id, record.userId, now]
      );
      return cart(result.rows[0]);
    },

    async addItem(record, now) {
      return transaction(pool, async (client) => {
        await client.query("UPDATE carts SET updated_at = $2 WHERE id::text = $1", [record.cartId, now]);
        const inserted = await client.query(
          `INSERT INTO cart_items(id, cart_id, inventory_item_id, listing_id, price_snapshot, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (cart_id, inventory_item_id) DO UPDATE SET listing_id = EXCLUDED.listing_id, price_snapshot = EXCLUDED.price_snapshot
           RETURNING id, cart_id, inventory_item_id, listing_id, price_snapshot`,
          [record.id, record.cartId, record.inventoryItemId, record.listingId, record.priceSnapshot, now]
        );
        return item(inserted.rows[0]);
      });
    },

    async listItems(cartId) {
      const result = await pool.query(
        "SELECT id, cart_id, inventory_item_id, listing_id, price_snapshot FROM cart_items WHERE cart_id::text = $1 ORDER BY created_at",
        [cartId]
      );
      return result.rows.map(item);
    },

    async removeItem(cartId, inventoryItemId) {
      const result = await pool.query(
        "DELETE FROM cart_items WHERE cart_id::text = $1 AND inventory_item_id::text = $2",
        [cartId, inventoryItemId]
      );
      return result.rowCount >= 1;
    }
  });
}
