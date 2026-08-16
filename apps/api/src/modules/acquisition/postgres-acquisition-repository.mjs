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

function valuation(row) {
  return Object.freeze({
    id: row.id,
    sellRequestId: row.sell_request_id,
    valuationType: row.valuation_type,
    lowValue: row.low_value == null ? null : Number(row.low_value),
    highValue: row.high_value == null ? null : Number(row.high_value),
    recommendedValue: row.recommended_value == null ? null : Number(row.recommended_value),
    inputsSnapshot: row.inputs_snapshot,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString()
  });
}

function offer(row) {
  return Object.freeze({
    id: row.id,
    sellRequestId: row.sell_request_id,
    valuationId: row.valuation_id,
    amount: Number(row.amount),
    status: row.status,
    expiresAt: new Date(row.expires_at).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString()
  });
}

function acquisition(row) {
  return Object.freeze({
    id: row.id,
    sellRequestId: row.sell_request_id,
    acceptedOfferId: row.accepted_offer_id,
    sellerUserId: row.seller_user_id,
    sourceType: row.source_type,
    agreedPrice: Number(row.agreed_price),
    paymentStatus: row.payment_status,
    ownershipConfirmedAt: row.ownership_confirmed_at ? new Date(row.ownership_confirmed_at).toISOString() : null,
    acquiredAt: new Date(row.acquired_at).toISOString(),
    idempotencyKey: row.idempotency_key
  });
}

export function createPostgresAcquisitionRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createValuation(record) {
      const result = await pool.query(
        `INSERT INTO valuations(id, sell_request_id, valuation_type, low_value, high_value, recommended_value, inputs_snapshot, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         RETURNING id, sell_request_id, valuation_type, low_value, high_value, recommended_value, inputs_snapshot, created_by, created_at`,
        [record.id, record.sellRequestId, record.valuationType, record.lowValue, record.highValue, record.recommendedValue, record.inputsSnapshot == null ? null : JSON.stringify(record.inputsSnapshot), record.createdBy, record.createdAt]
      );
      return valuation(result.rows[0]);
    },

    async createOffer(record) {
      const result = await pool.query(
        `INSERT INTO offers(id, sell_request_id, valuation_id, amount, status, expires_at, created_by, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7)
         RETURNING id, sell_request_id, valuation_id, amount, status, expires_at, accepted_at, created_by, created_at`,
        [record.id, record.sellRequestId, record.valuationId, record.amount, record.expiresAt, record.createdBy, record.createdAt]
      );
      return offer(result.rows[0]);
    },

    async acceptOffer(offerId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE offers SET status = 'ACCEPTED', accepted_at = $2
           WHERE id = $1 AND status = 'ACTIVE' AND expires_at > $2
           RETURNING id, sell_request_id, valuation_id, amount, status, expires_at, accepted_at, created_by, created_at`,
          [offerId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_acceptable" };
        return { status: "accepted", record: offer(updated.rows[0]) };
      });
    },

    async findOfferById(offerId) {
      const result = await pool.query("SELECT id, sell_request_id, valuation_id, amount, status, expires_at, accepted_at, created_by, created_at FROM offers WHERE id::text = $1", [offerId]);
      return result.rows[0] ? offer(result.rows[0]) : null;
    },

    async createAcquisition(record, offer, now) {
      return transaction(pool, async (client) => {
        if (offer.status !== "ACCEPTED") throw Object.assign(new Error("offer not accepted"), { code: "23514" });
        if (Number(offer.amount) !== record.agreedPrice) throw Object.assign(new Error("agreed price mismatch"), { code: "23514" });
        const inserted = await client.query(
          `INSERT INTO acquisitions(id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9)
           RETURNING id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key`,
          [record.id, record.sellRequestId, record.acceptedOfferId, record.sellerUserId, record.sourceType, record.agreedPrice, record.ownershipConfirmedAt, record.acquiredAt, record.idempotencyKey]
        );
        return acquisition(inserted.rows[0]);
      });
    },

    async findByOffer(acceptedOfferId) {
      const result = await pool.query(
        "SELECT id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key FROM acquisitions WHERE accepted_offer_id::text = $1",
        [acceptedOfferId]
      );
      return result.rows[0] ? acquisition(result.rows[0]) : null;
    },

    async markPaid(acquisitionId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE acquisitions SET payment_status = 'PAID'
           WHERE id::text = $1 AND payment_status = 'PENDING'
           RETURNING id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key`,
          [acquisitionId]
        );
        if (updated.rowCount !== 1) return { status: "not_payable" };
        return { status: "paid", record: acquisition(updated.rows[0]) };
      });
    }
  });
}
