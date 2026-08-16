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

function toRecord(row) {
  return Object.freeze({
    id: row.id,
    orderItemId: row.order_item_id,
    status: row.status,
    reasonCode: row.reason_code,
    customerNotes: row.customer_notes,
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : null,
    receivedAt: row.received_at ? new Date(row.received_at).toISOString() : null,
    resolutionType: row.resolution_type,
    resolutionAmount: row.resolution_amount == null ? null : Number(row.resolution_amount)
  });
}

export function createPostgresReturnRequestRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO return_requests(id, order_item_id, status, reason_code, customer_notes, requested_at)
         VALUES ($1, $2, 'REQUESTED', $3, $4, $5)
         RETURNING id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount`,
        [record.id, record.orderItemId, record.reasonCode, record.customerNotes, record.requestedAt]
      );
      return toRecord(result.rows[0]);
    },

    async approve(id, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE return_requests SET status = 'APPROVED'
           WHERE id = $1 AND status = 'REQUESTED'
           RETURNING id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount`,
          [id]
        );
        if (updated.rowCount !== 1) return { status: "not_approvable" };
        return { status: "approved", record: toRecord(updated.rows[0]) };
      });
    },

    async markReceived(id, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE return_requests SET status = 'RECEIVED', received_at = $2
           WHERE id = $1 AND status = 'APPROVED'
           RETURNING id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount`,
          [id, now]
        );
        if (updated.rowCount !== 1) return { status: "not_receivable" };
        return { status: "received", record: toRecord(updated.rows[0]) };
      });
    },

    async settleRefund(id, amount, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE return_requests SET status = 'REFUNDED', resolution_type = 'REFUND', resolution_amount = $2
           WHERE id = $1 AND status = 'RECEIVED'
           RETURNING id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount`,
          [id, amount]
        );
        if (updated.rowCount !== 1) return { status: "not_refundable" };
        return { status: "refunded", record: toRecord(updated.rows[0]) };
      });
    },

    async findById(id) {
      const result = await pool.query("SELECT id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount FROM return_requests WHERE id::text = $1", [id]);
      return result.rows[0] ? toRecord(result.rows[0]) : null;
    },

    async findRefundableByOrderItem(orderItemId) {
      const result = await pool.query(
        "SELECT id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount FROM return_requests WHERE order_item_id::text = $1 AND status IN ('REQUESTED','APPROVED','RECEIVED','REFUNDED')",
        [orderItemId]
      );
      return result.rows[0] ? toRecord(result.rows[0]) : null;
    },

    async orderItemInventoryId(orderItemId) {
      const result = await pool.query("SELECT inventory_item_id FROM order_items WHERE id::text = $1", [orderItemId]);
      return result.rows[0]?.inventory_item_id ?? null;
    }
  });
}
