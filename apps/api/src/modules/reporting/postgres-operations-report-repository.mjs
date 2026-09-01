export function createPostgresOperationsReportRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  const count = async (name) => {
    const result = await pool.query(`SELECT count(*)::int AS c FROM ${name}`);
    return result.rows[0].c;
  };

  return Object.freeze({
    async counts() {
      const [customers, activeListings, pendingReturns, openClaims] = await Promise.all([
        count("users"),
        count("listings"),
        count("return_requests"),
        count("claims")
      ]);
      return Object.freeze({ customers, activeListings, pendingReturns, openClaims });
    },

    async recentOrders() {
      const result = await pool.query(
        `SELECT id, order_no, status, total_amount, created_at
         FROM orders ORDER BY created_at DESC LIMIT 10`
      );
      return result.rows.map((r) => Object.freeze({
        id: r.id,
        orderNo: r.order_no,
        status: r.status,
        totalAmount: Number(r.total_amount),
        createdAt: new Date(r.created_at).toISOString()
      }));
    },

    async recentSellRequests() {
      const result = await pool.query(
        `SELECT id, status, category_id, created_at
         FROM sell_requests ORDER BY created_at DESC LIMIT 10`
      );
      return result.rows.map((r) => Object.freeze({
        id: r.id,
        status: r.status,
        categoryId: r.category_id,
        createdAt: new Date(r.created_at).toISOString()
      }));
    },

    // Server-owned inventory cost picture: the acquisition seed plus appended
    // item_costs allocations, split by cost type. Never client-authored.
    async inventoryCost() {
      const totals = await pool.query(
        `SELECT
           COALESCE(SUM(acquisition_cost), 0) AS acquisition,
           COALESCE((SELECT SUM(amount) FROM item_costs), 0) AS allocated`
        + ` FROM inventory_items`
      );
      const row = totals.rows[0] ?? { acquisition: 0, allocated: 0 };
      const byType = await pool.query(
        `SELECT cost_type, COALESCE(SUM(amount), 0) AS total
         FROM item_costs GROUP BY cost_type ORDER BY cost_type`
      );
      const acquisition = Number(row.acquisition);
      const allocated = Number(row.allocated);
      return Object.freeze({
        acquisition,
        allocated,
        totalCost: acquisition + allocated,
        byType: Object.freeze(byType.rows.map((r) => Object.freeze({ costType: r.cost_type, total: Number(r.total) })))
      });
    }
  });
}
