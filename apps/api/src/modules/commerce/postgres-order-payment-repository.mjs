async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Swallow a failed rollback (e.g. connection already broken) so the
      // original error surfaces instead of being masked by a secondary one.
    }
    throw error;
  } finally {
    client.release();
  }
}

function order(row) {
  return Object.freeze({
    id: row.id,
    orderNo: row.order_no,
    userId: row.user_id,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    shippingAmount: Number(row.shipping_amount),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    placedAt: row.placed_at ? new Date(row.placed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

function payment(row) {
  return Object.freeze({
    id: row.id,
    orderId: row.order_id,
    direction: row.payment_direction,
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    method: row.method,
    amount: Number(row.amount),
    status: row.status,
    initiatedAt: new Date(row.initiated_at).toISOString(),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null
  });
}

export function createPostgresOrderPaymentRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    // Creates the order and every item snapshot in a single transaction so a
    // mid-loop failure can never leave a permanently orphaned, item-less order
    // (the order id is server-generated per call, so a retry after a partial
    // failure would otherwise create a new orphan rather than resuming).
    async createOrderWithItems(record, items) {
      return transaction(pool, async (client) => {
        const orderNo = await client.query("SELECT 'ORD-' || to_char(nextval('orders_no_seq'), 'FM000000') AS no");
        const inserted = await client.query(
          `INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'PENDING_PAYMENT', $4, $5, $6, $7, $8, $9, $9, $9)
           RETURNING id, order_no, user_id, status, currency, subtotal, shipping_amount, discount_amount, total_amount, placed_at, created_at, updated_at`,
          [record.id, orderNo.rows[0].no, record.userId, record.currency, record.subtotal, record.shippingAmount, record.discountAmount, record.totalAmount, record.placedAt]
        );
        const orderItems = [];
        for (const snapshot of items) {
          const result = await client.query(
            `INSERT INTO order_items(id, order_id, inventory_item_id, listing_id, product_model_id, pcx_item_id_snapshot, product_name_snapshot, spec_snapshot, grade_snapshot, health_score_snapshot, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
             RETURNING id`,
            [snapshot.id, snapshot.orderId, snapshot.inventoryItemId, snapshot.listingId, snapshot.productModelId, snapshot.pcxItemId, snapshot.productName, JSON.stringify(snapshot.specs), snapshot.grade, snapshot.healthScore, snapshot.unitPrice]
          );
          orderItems.push({ id: result.rows[0].id });
        }
        return { order: order(inserted.rows[0]), items: orderItems };
      });
    },

    async createPayment(record) {
      const result = await pool.query(
        `INSERT INTO payments(id, order_id, payment_direction, provider, provider_transaction_id, method, amount, status, initiated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIATED', $8)
         RETURNING id, order_id, payment_direction, provider, provider_transaction_id, method, amount, status, initiated_at, confirmed_at`,
        [record.id, record.orderId, record.direction, record.provider, record.providerTransactionId, record.method, record.amount, record.initiatedAt]
      );
      return payment(result.rows[0]);
    },

    // Ownership is enforced here (not just role): the payment's order must
    // belong to the confirming customer, otherwise any authenticated customer
    // could confirm any other customer's payment by guessing/observing a
    // provider transaction id.
    async confirmPayment(providerTransactionId, userId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE payments SET status = 'CONFIRMED', confirmed_at = $3
           WHERE provider_transaction_id = $1 AND status = 'INITIATED'
             AND order_id IN (SELECT id FROM orders WHERE user_id = $2)
           RETURNING id, order_id, payment_direction, provider, provider_transaction_id, method, amount, status, initiated_at, confirmed_at`,
          [providerTransactionId, userId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_confirmable" };
        return { status: "confirmed", record: payment(updated.rows[0]) };
      });
    }
  });
}
