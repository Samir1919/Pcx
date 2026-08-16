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

function row(record) {
  return Object.freeze({
    id: record.id,
    inventoryItemId: record.inventory_item_id,
    cartId: record.cart_id,
    reservedByUserId: record.reserved_by_user_id,
    status: record.status,
    reservedUntil: new Date(record.reserved_until).toISOString(),
    convertedAt: record.converted_at ? new Date(record.converted_at).toISOString() : null,
    createdAt: new Date(record.created_at).toISOString()
  });
}

export function createPostgresReservationRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    // The one-active-per-item partial unique index is the authoritative
    // double-sell guard. A second ACTIVE insert raises 23505.
    async create(record) {
      const result = await pool.query(
        `INSERT INTO reservations(id, inventory_item_id, cart_id, reserved_by_user_id, status, reserved_until, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
         RETURNING id, inventory_item_id, cart_id, reserved_by_user_id, status, reserved_until, converted_at, created_at`,
        [record.id, record.inventoryItemId, record.cartId, record.reservedByUserId, record.reservedUntil, record.createdAt]
      );
      return row(result.rows[0]);
    },

    async convert(reservationId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE reservations SET status = 'CONVERTED', converted_at = $2
           WHERE id = $1 AND status = 'ACTIVE' AND reserved_until > $2
           RETURNING id, inventory_item_id, cart_id, reserved_by_user_id, status, reserved_until, converted_at, created_at`,
          [reservationId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_convertible" };
        return { status: "converted", record: row(updated.rows[0]) };
      });
    },

    async findById(id) {
      const result = await pool.query("SELECT id, inventory_item_id, cart_id, reserved_by_user_id, status, reserved_until, converted_at, created_at FROM reservations WHERE id::text = $1", [id]);
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async findActiveByItem(inventoryItemId, now) {
      const result = await pool.query(
        "SELECT id, inventory_item_id, cart_id, reserved_by_user_id, status, reserved_until, converted_at, created_at FROM reservations WHERE inventory_item_id::text = $1 AND status = 'ACTIVE' AND reserved_until > $2",
        [inventoryItemId, now]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    }
  });
}
