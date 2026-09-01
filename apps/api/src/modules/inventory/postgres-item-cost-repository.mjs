function record(row) {
  return Object.freeze({
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    costType: row.cost_type,
    amount: Number(row.amount),
    reference: row.reference ?? null,
    recordedBy: row.recorded_by,
    createdAt: new Date(row.created_at).toISOString()
  });
}

const columns = "id, inventory_item_id, cost_type, amount, reference, recorded_by, created_at";

export function createPostgresItemCostRepository({ pool }) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");

  return Object.freeze({
    // Append a single cost entry. The FK to inventory_items and users enforces
    // referential integrity server-side; an invalid item surfaces as 23503.
    async create(cost) {
      const result = await pool.query(
        `INSERT INTO item_costs(id, inventory_item_id, cost_type, amount, reference, recorded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${columns}`,
        [cost.id, cost.inventoryItemId, cost.costType, cost.amount, cost.reference, cost.recordedBy, cost.createdAt]
      );
      return record(result.rows[0]);
    },

    // All cost entries for an item, newest first.
    async listByInventoryItem(inventoryItemId) {
      const result = await pool.query(
        `SELECT ${columns} FROM item_costs WHERE inventory_item_id::text = $1 ORDER BY created_at DESC`,
        [inventoryItemId]
      );
      return result.rows.map(record);
    },

    // Server-derived totals for one item: the acquisition seed (migration 0036)
    // plus the sum of appended cost entries. The client never authors a total.
    async totalByInventoryItem(inventoryItemId) {
      const result = await pool.query(
        `SELECT
           COALESCE((SELECT acquisition_cost FROM inventory_items WHERE id::text = $1), 0) AS seed,
           COALESCE((SELECT SUM(amount) FROM item_costs WHERE inventory_item_id::text = $1), 0) AS allocated`,
        [inventoryItemId]
      );
      const row = result.rows[0] ?? { seed: 0, allocated: 0 };
      const seed = Number(row.seed);
      const allocated = Number(row.allocated);
      return Object.freeze({ seed, allocated, totalCost: seed + allocated });
    },

    // Aggregate cost allocation by type across the whole ledger, used by the
    // operations report to surface the server-owned cost picture.
    async sumByType() {
      const result = await pool.query(
        `SELECT cost_type, COALESCE(SUM(amount), 0) AS total
         FROM item_costs
         GROUP BY cost_type
         ORDER BY cost_type`
      );
      return Object.freeze(result.rows.map((r) => Object.freeze({ costType: r.cost_type, total: Number(r.total) })));
    }
  });
}
