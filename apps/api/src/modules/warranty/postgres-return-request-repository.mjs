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
    resolutionAmount: row.resolution_amount == null ? null : Number(row.resolution_amount),
    refundProvider: row.refund_provider ?? null,
    refundProviderTransactionId: row.refund_provider_transaction_id ?? null,
    refundProviderStatus: row.refund_provider_status ?? null
  });
}

const columns = "id, order_item_id, status, reason_code, customer_notes, requested_at, received_at, resolution_type, resolution_amount, refund_provider, refund_provider_transaction_id, refund_provider_status";

export function createPostgresReturnRequestRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO return_requests(id, order_item_id, status, reason_code, customer_notes, requested_at)
         VALUES ($1, $2, 'REQUESTED', $3, $4, $5)
         RETURNING ${columns}`,
        [record.id, record.orderItemId, record.reasonCode, record.customerNotes, record.requestedAt]
      );
      return toRecord(result.rows[0]);
    },

    async approve(id, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE return_requests SET status = 'APPROVED'
           WHERE id = $1 AND status = 'REQUESTED'
           RETURNING ${columns}`,
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
           RETURNING ${columns}`,
          [id, now]
        );
        if (updated.rowCount !== 1) return { status: "not_receivable" };
        return { status: "received", record: toRecord(updated.rows[0]) };
      });
    },

    async settleRefund(id, amount, now, provider = {}) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE return_requests SET status = 'REFUNDED', resolution_type = 'REFUND', resolution_amount = $2,
                  refund_provider = $3, refund_provider_transaction_id = $4, refund_provider_status = $5
           WHERE id = $1 AND status = 'RECEIVED'
           RETURNING ${columns}`,
          [id, amount, provider.provider ?? null, provider.providerTransactionId ?? null, provider.providerStatus ?? null]
        );
        if (updated.rowCount !== 1) return { status: "not_refundable" };
        return { status: "refunded", record: toRecord(updated.rows[0]) };
      });
    },

    async list() {
      const result = await pool.query(
        `SELECT ${columns} FROM return_requests ORDER BY requested_at DESC LIMIT 100`,
        []
      );
      return result.rows.map(toRecord);
    },

    async findById(id) {
      const result = await pool.query(`SELECT ${columns} FROM return_requests WHERE id::text = $1`, [id]);
      return result.rows[0] ? toRecord(result.rows[0]) : null;
    },

    async findRefundableByOrderItem(orderItemId) {
      const result = await pool.query(
        `SELECT ${columns} FROM return_requests WHERE order_item_id::text = $1 AND status IN ('REQUESTED','APPROVED','RECEIVED','REFUNDED')`,
        [orderItemId]
      );
      return result.rows[0] ? toRecord(result.rows[0]) : null;
    },

    async orderItemInventoryId(orderItemId) {
      const result = await pool.query("SELECT inventory_item_id FROM order_items WHERE id::text = $1", [orderItemId]);
      return result.rows[0]?.inventory_item_id ?? null;
    },

    // Resolve the sold unit's primary serial through order_items → inventory_items
    // → serial_identifiers. The normalized value is the authoritative match key;
    // full display serials never cross the public boundary.
    async findPrimarySerialByOrderItem(orderItemId) {
      const result = await pool.query(
        `SELECT si.value_normalized
         FROM order_items oi
         JOIN inventory_items ii ON ii.id = oi.inventory_item_id
         JOIN serial_identifiers si ON si.inventory_item_id = ii.id AND si.is_primary = true
         WHERE oi.id::text = $1
         LIMIT 1`,
        [orderItemId]
      );
      return result.rows[0]?.value_normalized ?? null;
    }
  });
}
