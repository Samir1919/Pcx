import assert from "node:assert/strict";
import test from "node:test";
// This smoke test intentionally guards the worker's direct coupling to apps/api
// internals. The worker composition imports these four modules by relative path;
// if an apps/api refactor moves or renames them, this test fails at import time
// with an explicit signal instead of a runtime-only break in the worker.
import { createShipmentService } from "../../api/src/modules/logistics/shipment-service.mjs";
import { createPostgresShipmentRepository } from "../../api/src/modules/logistics/postgres-shipment-repository.mjs";
import { createNotificationService } from "../../api/src/modules/notification/notification-service.mjs";
import { createPostgresNotificationRepository } from "../../api/src/modules/notification/postgres-notification-repository.mjs";

test("worker's coupled apps/api modules remain importable and export the expected contract", () => {
  assert.equal(typeof createShipmentService, "function");
  assert.equal(typeof createPostgresShipmentRepository, "function");
  assert.equal(typeof createNotificationService, "function");
  assert.equal(typeof createPostgresNotificationRepository, "function");
});
