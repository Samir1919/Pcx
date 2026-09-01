import assert from "node:assert/strict";
import test from "node:test";
import { createOperationsReportService } from "../src/modules/reporting/operations-report-service.mjs";

function repository() {
  return {
    async counts() { return { customers: 10, activeListings: 3, pendingReturns: 1, openClaims: 2 }; },
    async recentOrders() { return [{ id: "o1", orderNo: "ORD-1", status: "CONFIRMED", totalAmount: 1000, createdAt: "2026-08-16T12:00:00.000Z" }]; },
    async recentSellRequests() { return [{ id: "sr1", status: "SUBMITTED", categoryId: "gpu", createdAt: "2026-08-16T12:00:00.000Z" }]; },
    async inventoryCost() { return { acquisition: 4200, allocated: 125.5, totalCost: 4325.5, byType: [] }; },
    async revenueSummary() { return { orderCount: 2, revenue: 2000, tax: 100, shipping: 0, averageOrder: 1000, byStatus: [{ status: "CONFIRMED", count: 2, revenue: 2000 }] }; },
    async inventoryValue() { return [{ grade: "A", count: 3, cost: 4200 }]; }
  };
}

test("operations dashboard requires AUDIT_READ/SYSTEM_CONFIGURE and returns counts", async () => {
  const service = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["FINANCE"] }; } },
    repository: repository()
  });

  const result = await service.dashboard("access");
  assert.equal(result.counts.customers, 10);
  assert.equal(result.recentOrders.length, 1);
  assert.equal(result.recentSellRequests[0].status, "SUBMITTED");
  assert.equal(result.inventoryCost.totalCost, 4325.5);

  const denied = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository: repository()
  });
  await assert.rejects(denied.dashboard("access"), (error) => error.code === "forbidden");
});

test("BI dashboard returns server-derived revenue and inventory value", async () => {
  const service = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: repository()
  });
  const result = await service.biDashboard("access");
  assert.equal(result.revenue.orderCount, 2);
  assert.equal(result.revenue.revenue, 2000);
  assert.equal(result.revenue.byStatus[0].count, 2);
  assert.equal(result.inventoryValue[0].grade, "A");
  assert.equal(result.inventoryValue[0].cost, 4200);
});

test("operations CSV export is server-generated and permission-gated", async () => {
  const service = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: repository()
  });
  const csv = await service.exportOperationsCsv("access");
  assert.match(csv, /metric,value/);
  assert.match(csv, /customers,10/);
  assert.match(csv, /revenue,2000/);

  const denied = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository: repository()
  });
  await assert.rejects(denied.exportOperationsCsv("access"), (error) => error.code === "forbidden");
});
