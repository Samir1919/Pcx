import { createShipmentService } from "../../api/src/modules/logistics/shipment-service.mjs";
import { createPostgresShipmentRepository } from "../../api/src/modules/logistics/postgres-shipment-repository.mjs";
import { createNotificationService } from "../../api/src/modules/notification/notification-service.mjs";
import { createPostgresNotificationRepository } from "../../api/src/modules/notification/postgres-notification-repository.mjs";
import { createNotificationEmitter } from "../../api/src/modules/notification/notification-emitter.mjs";
import { createPostgresNotificationProviderConfigRepository } from "../../api/src/modules/notification/postgres-notification-provider-config-repository.mjs";
import { createNotificationProviderConfigService } from "../../api/src/modules/notification/notification-provider-config-service.mjs";
import { createConfiguredNotificationDispatchers } from "../../api/src/modules/notification/configured-notification-dispatchers.mjs";
import { createPostgresOrderPaymentRepository } from "../../api/src/modules/commerce/postgres-order-payment-repository.mjs";
import { createOrderPaymentService } from "../../api/src/modules/commerce/order-payment-service.mjs";
import { createReservationService } from "../../api/src/modules/commerce/reservation-service.mjs";
import { createPostgresReservationRepository } from "../../api/src/modules/commerce/postgres-reservation-repository.mjs";
import { createPostgresListingRepository } from "../../api/src/modules/listing/postgres-listing-repository.mjs";
import { createPostgresScheduledExportRepository } from "../../api/src/modules/reporting/postgres-scheduled-export-repository.mjs";
import { createScheduledExportService } from "../../api/src/modules/reporting/scheduled-export-service.mjs";
import { createPostgresRetentionRepository } from "../../api/src/modules/reporting/postgres-retention-repository.mjs";
import { createRetentionService } from "../../api/src/modules/reporting/retention-service.mjs";
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
  const notificationRepository = createPostgresNotificationRepository({ pool });
  const notificationEmitter = createNotificationEmitter({ repository: notificationRepository });

  // The worker resolves the buyer for a delivery webhook through the commerce
  // module's public getUserIdByOrder method (never a raw cross-module query),
  // then emits the customer notification into the same outbox it dispatches.
  const orderPaymentService = createOrderPaymentService({
    authService: workerAuthService,
    repository: createPostgresOrderPaymentRepository({ pool })
  });
  const shipmentService = createShipmentService({
    authService: workerAuthService,
    repository: createPostgresShipmentRepository({ pool }),
    webhookSecret: courierWebhookSecret,
    maxWebhookRetries,
    notificationEmitter,
    orderUserResolver: async ({ orderId }) => orderPaymentService.getUserIdByOrder(orderId)
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
    repository: notificationRepository,
    dispatchers: resolvedDispatchers
  });
  const reservationService = createReservationService({
    authService: workerAuthService,
    listingRepository: createPostgresListingRepository({ pool }),
    reservationRepository: createPostgresReservationRepository({ pool })
  });
  // Scheduled exports: the worker regenerates due exports on their cadence and
  // records the run. countRows reads the underlying ledgers (never another
  // module's tables) so the run record carries a meaningful row count.
  const scheduledExportService = createScheduledExportService({
    authService: workerAuthService,
    repository: createPostgresScheduledExportRepository({ pool })
  });
  // Retention: purges obsolete rows on a daily throttle (safe categories only —
  // never financial/legal records, inventory, inspections, or audit events).
  const retentionService = createRetentionService({
    repository: createPostgresRetentionRepository({ pool })
  });
  const countRows = async (report) => {
    if (report === "operations") {
      const r = await pool.query("SELECT (SELECT count(*) FROM orders)::int + (SELECT count(*) FROM sell_requests)::int AS c");
      return Number(r.rows[0].c);
    }
    if (report === "audit") {
      const r = await pool.query("SELECT count(*)::int AS c FROM audit_logs");
      return Number(r.rows[0].c);
    }
    return 0;
  };
  const worker = startWorker({
    shipmentService,
    notificationService,
    reservationService,
    scheduledExportService: { async runDue() { return scheduledExportService.runDue({ countRows }); } },
    retentionService,
    intervalMs,
    onError,
    unref
  });
  return Object.freeze({ worker, shipmentService, notificationService, reservationService, scheduledExportService, retentionService });
}
