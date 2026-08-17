import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerRuntime } from "../src/composition.mjs";

function fakePool() {
  const queries = [];
  const client = {
    async query(sql) { queries.push(sql); return { rows: [] }; },
    release() { }
  };
  return {
    pool: {
      async query(sql) { queries.push(sql); return { rows: [] }; },
      // The webhook outbox claim opens a transaction (FOR UPDATE SKIP LOCKED)
      // even when no rows are due, so connect() must yield a working client.
      async connect() { return client; }
    },
    queries
  };
}

test("createWorkerRuntime composes the real shipment and notification services", () => {
  const { pool } = fakePool();
  const runtime = createWorkerRuntime({ pool });
  assert.equal(typeof runtime.worker.runOnce, "function");
  assert.equal(typeof runtime.shipmentService.dispatchDueWebhookEvents, "function");
  assert.equal(typeof runtime.notificationService.dispatchDue, "function");
});

test("createWorkerRuntime requires a PostgreSQL pool", () => {
  assert.throws(() => createWorkerRuntime({}), /PostgreSQL pool is required/);
});

test("worker runOnce dispatches due webhook events and due notifications through the composed services", async () => {
  const { pool, queries } = fakePool();
  const runtime = createWorkerRuntime({ pool });
  const result = await runtime.worker.runOnce();
  assert.equal(result.status, "ran");
  assert.equal(result.durableTruth, "postgresql");
  assert.ok(queries.some((sql) => sql.includes("shipment_webhook_events")), "webhook outbox must be polled");
  assert.ok(queries.some((sql) => sql.includes("notifications")), "notifications must be polled");
});
