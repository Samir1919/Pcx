import { createShipmentService } from "../../api/src/modules/logistics/shipment-service.mjs";
import { createPostgresShipmentRepository } from "../../api/src/modules/logistics/postgres-shipment-repository.mjs";
import { createNotificationService } from "../../api/src/modules/notification/notification-service.mjs";
import { createPostgresNotificationRepository } from "../../api/src/modules/notification/postgres-notification-repository.mjs";
import { createPostgresNotificationProviderConfigRepository } from "../../api/src/modules/notification/postgres-notification-provider-config-repository.mjs";
import { createNotificationProviderConfigService } from "../../api/src/modules/notification/notification-provider-config-service.mjs";
import { createConfiguredNotificationDispatchers } from "../../api/src/modules/notification/configured-notification-dispatchers.mjs";
import { createReservationService } from "../../api/src/modules/commerce/reservation-service.mjs";
import { createPostgresReservationRepository } from "../../api/src/modules/commerce/postgres-reservation-repository.mjs";
import { createPostgresListingRepository } from "../../api/src/modules/listing/postgres-listing-repository.mjs";
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
  // The worker resolves the active EMAIL/SMS provider config at dispatch time
  // via getActiveCredentials (which never authenticates), while still honoring
  // any explicitly injected dispatchers for tests.
  const notificationProviderConfigService = createNotificationProviderConfigService({
    authService: workerAuthService,
    repository: createPostgresNotificationProviderConfigRepository({ pool })
  });
  const resolvedDispatchers = Object.keys(notificationDispatchers).length > 0
    ? notificationDispatchers
    : createConfiguredNotificationDispatchers({ providerConfig: notificationProviderConfigService });
  const notificationService = createNotificationService({
    authService: workerAuthService,
    repository: createPostgresNotificationRepository({ pool }),
    dispatchers: resolvedDispatchers
  });
  const reservationService = createReservationService({
    authService: workerAuthService,
    listingRepository: createPostgresListingRepository({ pool }),
    reservationRepository: createPostgresReservationRepository({ pool })
  });
  const worker = startWorker({ shipmentService, notificationService, reservationService, intervalMs, onError, unref });
  return Object.freeze({ worker, shipmentService, notificationService, reservationService });
}
