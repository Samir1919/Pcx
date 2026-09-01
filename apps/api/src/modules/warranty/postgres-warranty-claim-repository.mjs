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

function warranty(row) {
  return Object.freeze({
    id: row.id,
    orderItemId: row.order_item_id,
    inventoryItemId: row.inventory_item_id,
    policySnapshot: row.policy_snapshot,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString()
  });
}

function claim(row) {
  return Object.freeze({
    id: row.id,
    warrantyId: row.warranty_id,
    orderItemId: row.order_item_id,
    status: row.status,
    reasonCode: row.reason_code,
    symptoms: row.symptoms,
    requestedAt: new Date(row.requested_at).toISOString(),
    receivedAt: row.received_at ? new Date(row.received_at).toISOString() : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    inspectionId: row.inspection_id ?? null
  });
}

const claimColumns = "id, warranty_id, order_item_id, status, reason_code, symptoms, requested_at, received_at, resolved_at, inspection_id";

function resolution(row) {
  return Object.freeze({
    id: row.id,
    claimId: row.claim_id,
    resolutionType: row.resolution_type,
    notes: row.notes,
    costAmount: row.cost_amount == null ? null : Number(row.cost_amount),
    approvedBy: row.approved_by,
    createdAt: new Date(row.created_at).toISOString()
  });
}

export function createPostgresWarrantyClaimRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    async createWarranty(record) {
      const result = await pool.query(
        `INSERT INTO warranties(id, order_item_id, inventory_item_id, policy_snapshot, status, starts_at, ends_at)
         VALUES ($1, $2, $3, $4::jsonb, 'ACTIVE', $5, $6)
         RETURNING id, order_item_id, inventory_item_id, policy_snapshot, status, starts_at, ends_at`,
        [record.id, record.orderItemId, record.inventoryItemId, JSON.stringify(record.policySnapshot), record.startsAt, record.endsAt]
      );
      return warranty(result.rows[0]);
    },

    async createClaim(record) {
      const result = await pool.query(
        `INSERT INTO claims(id, warranty_id, order_item_id, status, reason_code, symptoms, requested_at)
         VALUES ($1, $2, $3, 'REQUESTED', $4, $5, $6)
         RETURNING ${claimColumns}`,
        [record.id, record.warrantyId, record.orderItemId, record.reasonCode, record.symptoms, record.requestedAt]
      );
      return claim(result.rows[0]);
    },

    async createResolution(record) {
      const result = await pool.query(
        `INSERT INTO claim_resolutions(id, claim_id, resolution_type, notes, cost_amount, approved_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, claim_id, resolution_type, notes, cost_amount, approved_by, created_at`,
        [record.id, record.claimId, record.resolutionType, record.notes, record.costAmount, record.approvedBy, record.createdAt]
      );
      return resolution(result.rows[0]);
    },

    async listWarranties() {
      const result = await pool.query(
        "SELECT id, order_item_id, inventory_item_id, policy_snapshot, status, starts_at, ends_at FROM warranties ORDER BY created_at DESC LIMIT 100",
        []
      );
      return result.rows.map(warranty);
    },

    async listClaims() {
      const result = await pool.query(
        `SELECT ${claimColumns} FROM claims ORDER BY requested_at DESC LIMIT 100`,
        []
      );
      return result.rows.map(claim);
    },

    async findWarrantyById(id) {
      const result = await pool.query("SELECT id, order_item_id, inventory_item_id, policy_snapshot, status, starts_at, ends_at FROM warranties WHERE id::text = $1", [id]);
      return result.rows[0] ? warranty(result.rows[0]) : null;
    },

    // Resolve the owning customer of a warranty by walking warranty → order item
    // → order. Used to let a customer open a claim on their own warranty while
    // keeping the authorization server-side.
    async findWarrantyOwnerUserId(warrantyId) {
      const result = await pool.query(
        `SELECT o.user_id
         FROM warranties w
         JOIN order_items oi ON oi.id = w.order_item_id
         JOIN orders o ON o.id = oi.order_id
         WHERE w.id::text = $1
         LIMIT 1`,
        [warrantyId]
      );
      return result.rows[0]?.user_id ?? null;
    },

    async markClaimResolved(claimId, now) {
      return transaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE claims SET status = 'RESOLVED', resolved_at = $2
           WHERE id = $1 AND status IN ('REQUESTED', 'IN_REVIEW')
           RETURNING ${claimColumns}`,
          [claimId, now]
        );
        if (updated.rowCount !== 1) return { status: "not_resolvable" };
        return { status: "resolved", record: claim(updated.rows[0]) };
      });
    },

    async findClaimById(id) {
      const result = await pool.query(`SELECT ${claimColumns} FROM claims WHERE id::text = $1`, [id]);
      return result.rows[0] ? claim(result.rows[0]) : null;
    },

    async linkInspection(claimId, inspectionId) {
      const result = await pool.query(
        `UPDATE claims SET inspection_id = $2, status = 'IN_REVIEW'
         WHERE id::text = $1 AND status = 'REQUESTED'
         RETURNING ${claimColumns}`,
        [claimId, inspectionId]
      );
      return result.rows[0] ? claim(result.rows[0]) : null;
    }
  });
}
