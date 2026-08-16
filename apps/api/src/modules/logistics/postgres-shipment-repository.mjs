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
    }
  });
}
