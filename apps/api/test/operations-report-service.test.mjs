import assert from "node:assert/strict";
import test from "node:test";
import { createOperationsReportService } from "../src/modules/reporting/operations-report-service.mjs";

test("operations dashboard requires AUDIT_READ/SYSTEM_CONFIGURE and returns counts", async () => {
  const repository = {
    async counts() { return { customers: 10, activeListings: 3, pendingReturns: 1, openClaims: 2 }; },
    async recentOrders() { return [{ id: "o1", orderNo: "ORD-1", status: "CONFIRMED", totalAmount: 1000, createdAt: "2026-08-16T12:00:00.000Z" }]; },
    async recentSellRequests() { return [{ id: "sr1", status: "SUBMITTED", categoryId: "gpu", createdAt: "2026-08-16T12:00:00.000Z" }]; }
  };
  const service = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["FINANCE"] }; } },
    repository
  });

  const result = await service.dashboard("access");
  assert.equal(result.counts.customers, 10);
  assert.equal(result.recentOrders.length, 1);
  assert.equal(result.recentSellRequests[0].status, "SUBMITTED");

  const denied = createOperationsReportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository
  });
  await assert.rejects(denied.dashboard("access"), (error) => error.code === "forbidden");
});
