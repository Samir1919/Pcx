const DAY_MS = 24 * 60 * 60 * 1000;

// Default retention windows (days). Closed reservations/sessions/offers and
// delivered notifications are purged after these windows elapse. These are safe
// defaults; audit events are intentionally NOT purged here (append-only trail),
// and financial/legal records are never deleted.
const DEFAULT_RETENTION_DAYS = Object.freeze({
  reservations: 30,
  notifications: 7,
  sessions: 30,
  offers: 30
});

export function createRetentionService({ repository, clock = () => new Date(), retentionDays = DEFAULT_RETENTION_DAYS }) {
  for (const method of ["deleteClosedReservations", "deleteDeliveredNotifications", "deleteExpiredSessions", "deleteClosedOffers"]) {
    if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  }

  function cutoff(days, now) {
    return new Date(now.getTime() - days * DAY_MS).toISOString();
  }

  return Object.freeze({
    // Run a retention pass. Returns per-category deletion counts. Each category
    // is independent and best-effort: a failure in one is collected, not thrown,
    // so a single blocked table never halts the whole pass.
    async run({ now = clock() } = {}) {
      const results = {};
      const errors = [];
      const tasks = [
        ["reservations", "deleteClosedReservations", retentionDays.reservations],
        ["notifications", "deleteDeliveredNotifications", retentionDays.notifications],
        ["sessions", "deleteExpiredSessions", retentionDays.sessions],
        ["offers", "deleteClosedOffers", retentionDays.offers]
      ];
      for (const [key, method, days] of tasks) {
        try {
          results[key] = await repository[method](cutoff(days, now));
        } catch (error) {
          results[key] = 0;
          errors.push({ category: key, message: error?.message ?? "retention failed" });
        }
      }
      return Object.freeze({ deleted: Object.freeze(results), errors: Object.freeze(errors), ranAt: now.toISOString() });
    }
  });
}