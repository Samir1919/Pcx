import { createShipmentService } from "../../api/src/modules/logistics/shipment-service.mjs";
import { createPostgresShipmentRepository } from "../../api/src/modules/logistics/postgres-shipment-repository.mjs";
import { createNotificationService } from "../../api/src/modules/notification/notification-service.mjs";
import { createPostgresNotificationRepository } from "../../api/src/modules/notification/postgres-notification-repository.mjs";
import { startWorker } from "./worker.mjs";

// The worker never performs an authenticated operation: it only dispatches due
// courier webhook outbox events and notifications against the PostgreSQL source
// of truth that the services already own. A real authService is therefore not
// required; the stub fails closed if a worker job ever attempts authentication.
const workerAuthService = Object.freeze({
  async authenticateAccess() {
    throw new Error("worker jobs never authenticate");
  }
});

/**
 * Composes the worker against the shared service/repository instances. The
 * worker and the HTTP API are both consumers of the same modular-monolith
 * services; the worker advances durable state the services own and never
 * manipulates another module's tables directly.
 *
 * Repositories and services run construction-time dependency validation only —
 * no database query is issued until the worker ticks.
 */
export function createWorkerRuntime({
  pool,
  courierWebhookSecret = process.env.COURIER_WEBHOOK_SECRET ?? null,
  maxWebhookRetries = 5,
  notificationDispatchers = {},
  intervalMs = 5_000,
  onError = () => { },
  unref = true
} = {}) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") throw new TypeError("PostgreSQL pool is required");
  const shipmentService = createShipmentService({
    authService: workerAuthService,
    repository: createPostgresShipmentRepository({ pool }),
    webhookSecret: courierWebhookSecret,
    maxWebhookRetries
  });
  const notificationService = createNotificationService({
    authService: workerAuthService,
    repository: createPostgresNotificationRepository({ pool }),
    dispatchers: notificationDispatchers
  });
  const worker = startWorker({ shipmentService, notificationService, intervalMs, onError, unref });
  return Object.freeze({ worker, shipmentService, notificationService });
}
