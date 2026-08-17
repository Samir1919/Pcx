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

function shipment(row) {
  return Object.freeze({
    id: row.id,
    orderId: row.order_id,
    courier: row.courier,
    trackingId: row.tracking_id,
    packageType: row.package_type,
    weight: Number(row.weight),
    codAmount: Number(row.cod_amount),
    shippingCharge: Number(row.shipping_charge),
    status: row.status,
    shippedAt: row.shipped_at ? new Date(row.shipped_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    returnedAt: row.returned_at ? new Date(row.returned_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  });
}


export function createPostgresShipmentRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO shipments(id, order_id, courier, tracking_id, package_type, weight, cod_amount, shipping_charge, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9)
         RETURNING id, order_id, courier, tracking_id, package_type, weight, cod_amount, shipping_charge, status, shipped_at, delivered_at, created_at`,
        [record.id, record.orderId, record.courier, record.trackingId, record.packageType, record.weight, record.codAmount, record.shippingCharge, record.createdAt]
      );
      return shipment(result.rows[0]);
    },

    async markShipped(shipmentId, trackingId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE shipments SET status = 'SHIPPED', tracking_id = $2, shipped_at = $3
           WHERE id = $1 AND status = 'DRAFT'
           RETURNING id, order_id, courier, tracking_id, package_type, weight, cod_amount, shipping_charge, status, shipped_at, delivered_at, created_at`,
          [shipmentId, trackingId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_shippable" };
        return { status: "shipped", record: shipment(updated.rows[0]) };
      });
    },

    async markDelivered(shipmentId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE shipments SET status = 'DELIVERED', delivered_at = $2
           WHERE id = $1 AND status = 'SHIPPED'
           RETURNING id, order_id, courier, tracking_id, package_type, weight, cod_amount, shipping_charge, status, shipped_at, delivered_at, returned_at, created_at`,
          [shipmentId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_deliverable" };
        return { status: "delivered", record: shipment(updated.rows[0]) };
      });
    },

    async markReturned(shipmentId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE shipments SET status = 'RETURNED', returned_at = $2
           WHERE id = $1 AND status = 'SHIPPED'
           RETURNING id, order_id, courier, tracking_id, package_type, weight, cod_amount, shipping_charge, status, shipped_at, delivered_at, returned_at, created_at`,
          [shipmentId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_returnable" };
        return { status: "returned", record: shipment(updated.rows[0]) };
      });
    },

    async recordEvent(event) {

      const result = await pool.query(
        `INSERT INTO shipment_events(id, shipment_id, status, provider_status_raw, occurred_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [event.id, event.shipmentId, event.status, event.providerStatusRaw, event.occurredAt]
      );
      return { id: result.rows[0].id };
    },

    // Durable outbox for inbound courier webhook events. Every webhook is
    // durably queued so a delivery event is never lost between receipt and
    // application. A worker retries PENDING events until APPLIED or FAILED.
    async enqueueWebhookEvent(event) {
      const result = await pool.query(
        `INSERT INTO shipment_webhook_events(id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at)
         VALUES ($1, $2, $3, $4, 'PENDING', 0, $5) RETURNING id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at, created_at`,
        [event.id, event.shipmentId, event.providerStatus, event.occurredAt, event.nextAttemptAt ?? null]
      );
      return webhookEvent(result.rows[0]);
    },

    async listPendingWebhookEvents(limit = 20) {
      const result = await pool.query(
        `SELECT id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at, created_at, applied_at
         FROM shipment_webhook_events
         WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
         ORDER BY created_at ASC LIMIT $1`,
        [limit]
      );
      return result.rows.map(webhookEvent);
    },

    // Claims a batch of due PENDING events for processing, using
    // FOR UPDATE SKIP LOCKED inside a transaction so two concurrent workers
    // never fetch the same rows. Each claimed row gets a short lease on
    // next_attempt_at that is overwritten by markWebhookApplied/markWebhookFailed
    // on completion; if the process crashes mid-processing, the lease expires and
    // the event is re-claimed (at-least-once).
    async claimPendingWebhookEvents(limit = 20) {
      return transaction(pool, async (client) => {
        const claimed = await client.query(
          `SELECT id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at, created_at, applied_at
           FROM shipment_webhook_events
           WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
           ORDER BY created_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED`,
          [limit]
        );
        for (const row of claimed.rows) {
          await client.query(
            `UPDATE shipment_webhook_events SET next_attempt_at = now() + interval '120 seconds'
             WHERE id = $1 AND status = 'PENDING'`,
            [row.id]
          );
        }
        return claimed.rows.map(webhookEvent);
      });
    },

    async markWebhookApplied(id, now) {
      const result = await pool.query(
        `UPDATE shipment_webhook_events SET status = 'APPLIED', applied_at = $2
         WHERE id = $1 AND status = 'PENDING'
         RETURNING id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at, created_at, applied_at`,
        [id, now]
      );
      if (result.rowCount !== 1) return null;
      return webhookEvent(result.rows[0]);
    },

    async markWebhookFailed(id, retryCount, nextAttemptAt) {
      // A failure only leaves the retry queue (status = 'FAILED') once the retry
      // budget is exhausted (nextAttemptAt IS NULL). While a retry is still
      // scheduled, the event stays PENDING with an updated retry count/backoff so
      // listPendingWebhookEvents will pick it up again instead of dropping it
      // after a single transient failure.
      const result = await pool.query(
        `UPDATE shipment_webhook_events
            SET status = CASE WHEN $3::timestamptz IS NULL THEN 'FAILED' ELSE 'PENDING' END,
                retry_count = $2,
                next_attempt_at = $3
          WHERE id = $1 AND status = 'PENDING'
          RETURNING id, shipment_id, provider_status, occurred_at, status, retry_count, next_attempt_at, created_at, applied_at`,
        [id, retryCount, nextAttemptAt ?? null]
      );
      if (result.rowCount !== 1) return null;
      return webhookEvent(result.rows[0]);
    }
  });
}

function webhookEvent(row) {
  return Object.freeze({
    id: row.id,
    shipmentId: row.shipment_id,
    providerStatus: row.provider_status,
    occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
    status: row.status,
    retryCount: Number(row.retry_count),
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null
  });
}

