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

// Auto-advance the linked sell request along the canonical graph after an
// offer/acquisition event. Best-effort + optimistic: only moves from the
// exact expected source state (mirrors SellRequestTransitions in @pcx/domain).
async function transitionSellRequest(client, sellRequestId, fromStatus, toStatus, now) {
  await client.query(
    `UPDATE sell_requests SET status = $3, updated_at = $4 WHERE id = $1 AND status = $2`,
    [sellRequestId, fromStatus, toStatus, now]
  );
}

function offer(row) {
  return Object.freeze({
    id: row.id,
    sellRequestId: row.sell_request_id,
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

const offerColumns = "id, sell_request_id, amount, status, expires_at, accepted_at, created_by, created_at";

export function createPostgresAcquisitionRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createOffer(record) {
      return transaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO offers(id, sell_request_id, amount, status, expires_at, created_by, created_at)
           VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6)
           RETURNING ${offerColumns}`,
          [record.id, record.sellRequestId, record.amount, record.expiresAt, record.createdBy, record.createdAt]
        );
        await transitionSellRequest(client, record.sellRequestId, "INSPECTING", "OFFERED", record.createdAt);
        return offer(result.rows[0]);
      });
    },

    async acceptOffer(offerId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE offers SET status = 'ACCEPTED', accepted_at = $2
           WHERE id = $1 AND status = 'ACTIVE' AND expires_at > $2
           RETURNING ${offerColumns}`,
          [offerId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_acceptable" };
        const accepted = offer(updated.rows[0]);
        await transitionSellRequest(client, accepted.sellRequestId, "OFFERED", "ACCEPTED", now);
        return { status: "accepted", record: accepted };
      });
    },

    async rejectOffer(offerId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE offers SET status = 'REJECTED'
           WHERE id = $1 AND status = 'ACTIVE'
           RETURNING ${offerColumns}`,
          [offerId]
        );
        if (updated.rowCount !== 1) return null;
        const rejected = offer(updated.rows[0]);
        await transitionSellRequest(client, rejected.sellRequestId, "OFFERED", "REJECTED_BY_SELLER", now);
        return rejected;
      });
    },

    // Resolve the seller (owner) of the offer via the linked sell_request, so
    // the service can enforce that only the owning customer may accept/reject.
    async findOwnerUserIdByOffer(offerId) {
      const result = await pool.query(
        `SELECT sr.user_id
         FROM offers o
         JOIN sell_requests sr ON sr.id = o.sell_request_id
         WHERE o.id::text = $1`,
        [offerId]
      );
      return result.rows[0]?.user_id ?? null;
    },

    async findOfferById(offerId) {
      const result = await pool.query(`SELECT ${offerColumns} FROM offers WHERE id::text = $1`, [offerId]);
      return result.rows[0] ? offer(result.rows[0]) : null;
    },

    // Owner lookup by sell request (not by offer) so a customer can only read
    // offers attached to a request they own.
    async findOwnerUserIdBySellRequest(sellRequestId) {
      const result = await pool.query(
        "SELECT user_id FROM sell_requests WHERE id::text = $1",
        [sellRequestId]
      );
      return result.rows[0]?.user_id ?? null;
    },

    async listOffersBySellRequest(sellRequestId) {
      const result = await pool.query(
        `SELECT ${offerColumns} FROM offers WHERE sell_request_id::text = $1 ORDER BY created_at DESC`,
        [sellRequestId]
      );
      return result.rows.map(offer);
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
        const created = acquisition(inserted.rows[0]);
        await transitionSellRequest(client, created.sellRequestId, "ACCEPTED", "ACQUISITION_PENDING", now);
        return created;
      });
    },

    async findByOffer(acceptedOfferId) {
      const result = await pool.query(
        "SELECT id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key FROM acquisitions WHERE accepted_offer_id::text = $1",
        [acceptedOfferId]
      );
      return result.rows[0] ? acquisition(result.rows[0]) : null;
    },

    async findAcquisitionBySellRequest(sellRequestId) {
      const result = await pool.query(
        "SELECT id, sell_request_id, accepted_offer_id, seller_user_id, source_type, agreed_price, payment_status, ownership_confirmed_at, acquired_at, idempotency_key FROM acquisitions WHERE sell_request_id::text = $1 ORDER BY acquired_at DESC LIMIT 1",
        [sellRequestId]
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
        const paid = acquisition(updated.rows[0]);
        await transitionSellRequest(client, paid.sellRequestId, "ACQUISITION_PENDING", "PAID", now);
        return { status: "paid", record: paid };
      });
    }
  });
}
