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
    taxAmount: Number(row.tax_amount),
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
    providerTrxId: row.provider_trx_id ?? null,
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
    //
    // Double-sell guard (spec §5/§22): the sellable listing is atomically moved
    // PUBLISHED -> RESERVED and the item's ACTIVE reservation is consumed exactly
    // once in the same transaction. A second order for an already-claimed item
    // finds no PUBLISHED row and aborts with item_unavailable, so the database
    // (not the UI) is the final authority that a physical item cannot be sold
    // twice.
    async createOrderWithItems(record, items) {
      return transaction(pool, async (client) => {
        const orderNo = await client.query("SELECT 'ORD-' || to_char(nextval('orders_no_seq'), 'FM000000') AS no");
        const inserted = await client.query(
          `INSERT INTO orders(id, order_no, user_id, status, currency, subtotal, shipping_amount, tax_amount, discount_amount, total_amount, placed_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'PENDING_PAYMENT', $4, $5, $6, $7, $8, $9, $10, $10, $10)
           RETURNING id, order_no, user_id, status, currency, subtotal, shipping_amount, tax_amount, discount_amount, total_amount, placed_at, created_at, updated_at`,
          [record.id, orderNo.rows[0].no, record.userId, record.currency, record.subtotal, record.shippingAmount, record.taxAmount, record.discountAmount, record.totalAmount, record.placedAt]
        );
        const orderItems = [];
        for (const snapshot of items) {
          // Claim the sellable listing for this physical item. At most one
          // PUBLISHED listing exists per item, so this is the authoritative
          // double-sell lock.
          const claimed = await client.query(
            `UPDATE listings SET status = 'RESERVED'
             WHERE inventory_item_id = $1 AND status = 'PUBLISHED'
             RETURNING id`,
            [snapshot.inventoryItemId]
          );
          if (claimed.rowCount !== 1) {
            const error = new Error("item is no longer available");
            error.code = "item_unavailable";
            throw error;
          }
          // Consume the ACTIVE reservation exactly once (expired/cancelled or
          // already-converted rows simply do not match).
          await client.query(
            `UPDATE reservations SET status = 'CONVERTED', converted_at = $2
             WHERE inventory_item_id = $1 AND status = 'ACTIVE'`,
            [snapshot.inventoryItemId, record.placedAt]
          );
          // Snapshot the actually-claimed listing id (server-authoritative),
          // not the client-supplied value, so a later confirmPayment can find
          // the claimed row by listing_id even when the client sent none.
          const result = await client.query(
            `INSERT INTO order_items(id, order_id, inventory_item_id, listing_id, product_model_id, pcx_item_id_snapshot, product_name_snapshot, spec_snapshot, grade_snapshot, health_score_snapshot, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
             RETURNING id`,
            [snapshot.id, snapshot.orderId, snapshot.inventoryItemId, claimed.rows[0].id, snapshot.productModelId, snapshot.pcxItemId, snapshot.productName, JSON.stringify(snapshot.specs), snapshot.grade, snapshot.healthScore, snapshot.unitPrice]
          );
          orderItems.push({ id: result.rows[0].id });
        }
        return { order: order(inserted.rows[0]), items: orderItems };
      });
    },

    // Public read for the composition root only (never exposed over HTTP):
    // resolves the owning user of an order so the logistics module can notify
    // the buyer without reaching into the commerce module's tables directly.
    async findUserIdByOrder(orderId) {
      const result = await pool.query(
        `SELECT user_id FROM orders WHERE id = $1`,
        [orderId]
      );
      return result.rows[0]?.user_id ?? null;
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
      return markConfirmed(pool, providerTransactionId, now, userId);
    },

    // Server-authoritative reconciliation for provider callbacks/IPNs. Unlike
    // confirmPayment, no ownership filter applies: the gateway's execute/query
    // already proved the money moved, so the server records the provider fact.
    // Still guarded by the same INITIATED -> CONFIRMED transition + double-sell
    // advance (order CONFIRMED, listings SOLD) inside one transaction.
    async reconcilePayment(providerTransactionId, now, trxId = null) {
      return markConfirmed(pool, providerTransactionId, now, null, trxId);
    },

    async findPaymentByProviderTransactionId(providerTransactionId) {
      const result = await pool.query(
        `SELECT id, order_id, payment_direction, provider, provider_transaction_id, provider_trx_id, method, amount, status, initiated_at, confirmed_at
         FROM payments WHERE provider_transaction_id = $1`,
        [providerTransactionId]
      );
      return result.rows[0] ? payment(result.rows[0]) : null;
    },

    async findPaymentByOrderId(orderId) {
      const result = await pool.query(
        `SELECT id, order_id, payment_direction, provider, provider_transaction_id, provider_trx_id, method, amount, status, initiated_at, confirmed_at
         FROM payments WHERE order_id::text = $1 AND direction = 'INBOUND'
         ORDER BY initiated_at DESC LIMIT 1`,
        [orderId]
      );
      return result.rows[0] ? payment(result.rows[0]) : null;
    }
  });
}

async function markConfirmed(pool, providerTransactionId, now, userId, trxId = null) {
  return transaction(pool, async (client) => {
    const where = userId != null
      ? "provider_transaction_id = $1 AND status = 'INITIATED' AND order_id IN (SELECT id FROM orders WHERE user_id = $2)"
      : "provider_transaction_id = $1 AND status = 'INITIATED'";
    const params = userId != null ? [providerTransactionId, userId, now] : [providerTransactionId, now];
    const updated = await client.query(
      `UPDATE payments SET status = 'CONFIRMED', confirmed_at = $${params.length}, provider_trx_id = COALESCE(provider_trx_id, $${params.length + 1})
       WHERE ${where}
       RETURNING id, order_id, payment_direction, provider, provider_transaction_id, provider_trx_id, method, amount, status, initiated_at, confirmed_at`,
      [...params, trxId]
    );
    if (updated.rowCount !== 1) return { status: "not_confirmable" };
    const orderId = updated.rows[0].order_id;
    // Payment received: advance the order and mark each claimed listing
    // SOLD (RESERVED -> SOLD) so the sold item can never return to the
    // sellable pool (spec 5/18/22).
    await client.query(
      `UPDATE orders SET status = 'CONFIRMED', updated_at = $2
       WHERE id = $1 AND status = 'PENDING_PAYMENT'`,
      [orderId, now]
    );
    await client.query(
      `UPDATE listings SET status = 'SOLD'
       WHERE id IN (SELECT listing_id FROM order_items WHERE order_id = $1)
         AND status = 'RESERVED'`,
      [orderId]
    );
    return { status: "confirmed", record: payment(updated.rows[0]) };
  });
}
