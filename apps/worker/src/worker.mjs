// Stage 3 worker. Runs bounded, idempotent background jobs against the
// PostgreSQL source of truth. Each job is a small, dependency-injected slice so
// the worker can be tested without a live database and wired to any service.
//
// Current jobs:
//   - dispatchDueWebhookEvents: retries PENDING courier webhook outbox events.
//   - dispatchDue (notifications): sends due notifications.
//   - expireDueReservations: expires ACTIVE reservations past reserved_until.
//
// The worker never owns business truth; it only advances durable state that the
// services already own. Jobs are idempotent and safe to run repeatedly.

export function startWorker({ shipmentService, notificationService, reservationService, scheduledExportService, intervalMs = 5_000, onError = console.error, unref = true } = {}) {
  if (shipmentService && typeof shipmentService.dispatchDueWebhookEvents !== "function") throw new TypeError("shipmentService.dispatchDueWebhookEvents is required");
  if (notificationService && typeof notificationService.dispatchDue !== "function") throw new TypeError("notificationService.dispatchDue is required");
  if (reservationService && typeof reservationService.expireDue !== "function") throw new TypeError("reservationService.expireDue is required");
  if (scheduledExportService && typeof scheduledExportService.runDue !== "function") throw new TypeError("scheduledExportService.runDue is required");

  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      if (shipmentService) await shipmentService.dispatchDueWebhookEvents();
      if (notificationService) await notificationService.dispatchDue();
      if (reservationService) await reservationService.expireDue();
      if (scheduledExportService) await scheduledExportService.runDue();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  }

  return Object.freeze({
    status: "idle",
    durableTruth: "postgresql",
    async runOnce() {
      await tick();
      return { status: "ran", durableTruth: "postgresql" };
    },
    start() {
      if (timer) return this;
      timer = setInterval(tick, intervalMs);
      // A foreground daemon (unref=false) keeps the event loop alive so the
      // interval actually fires; tests and short-lived callers keep unref=true.
      if (unref) timer.unref?.();
      return this;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      return this;
    }
  });
}
