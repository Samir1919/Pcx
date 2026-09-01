import { hasPermission, Permission } from "@pcx/domain";

export class ReportsError extends Error {
  constructor(code) { super(code); this.name = "ReportsError"; this.code = code; }
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLines(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function createOperationsReportService({ authService, repository }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["counts", "recentOrders", "recentSellRequests", "inventoryCost", "revenueSummary", "inventoryValue"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.AUDIT_READ) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new ReportsError("forbidden");
    return identity;
  }

  return Object.freeze({
    async dashboard(accessCredential) {
      await actor(accessCredential);
      const [counts, recentOrders, recentSellRequests, inventoryCost] = await Promise.all([
        repository.counts(),
        repository.recentOrders(),
        repository.recentSellRequests(),
        repository.inventoryCost()
      ]);
      return Object.freeze({ counts, recentOrders, recentSellRequests, inventoryCost });
    },

    // BI dashboard: lifecycle counts + revenue + inventory value. Every number
    // is server-derived from committed ledgers/snapshots.
    async biDashboard(accessCredential) {
      await actor(accessCredential);
      const [counts, revenue, inventoryValue, inventoryCost] = await Promise.all([
        repository.counts(),
        repository.revenueSummary(),
        repository.inventoryValue(),
        repository.inventoryCost()
      ]);
      return Object.freeze({ counts, revenue, inventoryValue, inventoryCost });
    },

    // CSV export of the operations/BI report (server-generated; never client
    // re-derived). Returns a text/csv body for admin download.
    async exportOperationsCsv(accessCredential) {
      await actor(accessCredential);
      const [counts, revenue, inventoryCost] = await Promise.all([
        repository.counts(),
        repository.revenueSummary(),
        repository.inventoryCost()
      ]);
      return csvLines([
        ["metric", "value"],
        ["customers", counts.customers],
        ["active_listings", counts.activeListings],
        ["pending_returns", counts.pendingReturns],
        ["open_claims", counts.openClaims],
        ["order_count", revenue.orderCount],
        ["revenue", revenue.revenue],
        ["tax", revenue.tax],
        ["shipping", revenue.shipping],
        ["average_order", revenue.averageOrder],
        ["inventory_acquisition_cost", inventoryCost.acquisition],
        ["inventory_allocated_cost", inventoryCost.allocated],
        ["inventory_total_cost", inventoryCost.totalCost]
      ]);
    }
  });
}
