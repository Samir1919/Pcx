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
    },

    // Revenue summary: server-derived from the orders ledger. Totals are never
    // client-authored; they come straight from committed order snapshots.
    async revenueSummary() {
      const result = await pool.query(
        `SELECT
           COUNT(*)::int AS order_count,
           COALESCE(SUM(total_amount), 0) AS revenue,
           COALESCE(SUM(tax_amount), 0) AS tax,
           COALESCE(SUM(shipping_amount), 0) AS shipping,
           COALESCE(ROUND(AVG(total_amount), 2), 0) AS avg_order
         FROM orders`
      );
      const row = result.rows[0] ?? {};
      const byStatus = await pool.query(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders GROUP BY status ORDER BY status`
      );
      return Object.freeze({
        orderCount: Number(row.order_count ?? 0),
        revenue: Number(row.revenue ?? 0),
        tax: Number(row.tax ?? 0),
        shipping: Number(row.shipping ?? 0),
        averageOrder: Number(row.avg_order ?? 0),
        byStatus: Object.freeze(byStatus.rows.map((r) => Object.freeze({ status: r.status, count: Number(r.count), revenue: Number(r.revenue) })))
      });
    },

    // Inventory value summary grouped by condition grade. Server-owned.
    async inventoryValue() {
      const byGrade = await pool.query(
        `SELECT COALESCE(condition_grade, 'UNGRADED') AS grade,
                COUNT(*)::int AS count,
                COALESCE(SUM(acquisition_cost), 0) AS cost
         FROM inventory_items
         GROUP BY COALESCE(condition_grade, 'UNGRADED')
         ORDER BY grade`
      );
      return Object.freeze(byGrade.rows.map((r) => Object.freeze({ grade: r.grade, count: Number(r.count), cost: Number(r.cost) })));
    }
  });
}
