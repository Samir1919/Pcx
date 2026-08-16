import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "../src/worker.mjs";

test("worker runOnce dispatches due webhook events and notifications", async () => {
  const calls = [];
  const shipmentService = { async dispatchDueWebhookEvents() { calls.push("webhook"); } };
  const notificationService = { async dispatchDue() { calls.push("notification"); } };
  const worker = startWorker({ shipmentService, notificationService });
  const result = await worker.runOnce();
  assert.equal(result.status, "ran");
  assert.equal(result.durableTruth, "postgresql");
  assert.deepEqual(calls, ["webhook", "notification"]);
});

test("worker runOnce is safe with no services wired", async () => {
  const worker = startWorker();
  const result = await worker.runOnce();
  assert.equal(result.status, "ran");
});

test("worker validates injected services", () => {
  assert.throws(() => startWorker({ shipmentService: {} }), /dispatchDueWebhookEvents/);
  assert.throws(() => startWorker({ notificationService: {} }), /dispatchDue/);
});

test("worker start/stop manages the interval and does not double-run", async () => {
  let webhookCalls = 0;
  const shipmentService = { async dispatchDueWebhookEvents() { webhookCalls += 1; } };
  const worker = startWorker({ shipmentService, intervalMs: 10 });
  worker.start();
  worker.start(); // idempotent
  await new Promise((resolve) => setTimeout(resolve, 35));
  worker.stop();
  const afterStop = webhookCalls;
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(webhookCalls, afterStop);
  assert.ok(webhookCalls >= 1);
});

test("worker surfaces job errors through onError without crashing", async () => {
  const errors = [];
  const shipmentService = { async dispatchDueWebhookEvents() { throw new Error("boom"); } };
  const worker = startWorker({ shipmentService, onError: (error) => errors.push(error.message) });
  const result = await worker.runOnce();
  assert.equal(result.status, "ran");
  assert.deepEqual(errors, ["boom"]);
});
