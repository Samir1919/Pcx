import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresOperationsReportRepository } from "../../src/modules/reporting/postgres-operations-report-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("operations report repository returns lifecycle counts and recent rows", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresOperationsReportRepository({ pool });
  try {
    const result = await repository.counts();
    assert.equal(typeof result.customers, "number");
    assert.equal(typeof result.activeListings, "number");
    assert.equal(typeof result.pendingReturns, "number");
    assert.equal(typeof result.openClaims, "number");

    const orders = await repository.recentOrders();
    assert.equal(Array.isArray(orders), true);
    assert.ok(orders.length <= 10);

    const sellRequests = await repository.recentSellRequests();
    assert.equal(Array.isArray(sellRequests), true);
    assert.ok(sellRequests.length <= 10);

    const revenue = await repository.revenueSummary();
    assert.equal(typeof revenue.orderCount, "number");
    assert.equal(typeof revenue.revenue, "number");
    assert.equal(Array.isArray(revenue.byStatus), true);

    const inventoryValue = await repository.inventoryValue();
    assert.equal(Array.isArray(inventoryValue), true);
  } finally {
    await pool.end();
  }
});
