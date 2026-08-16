// Stage 3 worker. Runs bounded, idempotent background jobs against the
// PostgreSQL source of truth. Each job is a small, dependency-injected slice so
// the worker can be tested without a live database and wired to any service.
//
// Current jobs:
//   - dispatchDueWebhookEvents: retries PENDING courier webhook outbox events.
//   - dispatchDue (notifications): sends due notifications.
//
// The worker never owns business truth; it only advances durable state that the
// services already own. Jobs are idempotent and safe to run repeatedly.

export function startWorker({ shipmentService, notificationService, intervalMs = 5_000, onError = () => { } } = {}) {
  if (shipmentService && typeof shipmentService.dispatchDueWebhookEvents !== "function") throw new TypeError("shipmentService.dispatchDueWebhookEvents is required");
  if (notificationService && typeof notificationService.dispatchDue !== "function") throw new TypeError("notificationService.dispatchDue is required");

  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      if (shipmentService) await shipmentService.dispatchDueWebhookEvents();
      if (notificationService) await notificationService.dispatchDue();
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
      timer.unref?.();
      return this;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      return this;
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.stdout.write(`${JSON.stringify(startWorker())}\n`);
}
