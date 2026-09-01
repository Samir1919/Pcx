// Retention repository — hard-deletes obsolete rows that are safe to purge.
//
// Each method targets rows that can never be referenced again by an active
// business flow (closed reservations, delivered/failed notifications, expired/
// revoked sessions, closed offers). Financial/legal records (orders, payments,
// acquisitions), inventory, inspections, and audit events are never touched here.

export function createPostgresRetentionRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  async function deleteRows(sql, params) {
    const result = await pool.query(sql, params);
    return result.rowCount;
  }

  return Object.freeze({
    // Closed reservations older than the cutoff (never referenced by a live cart).
    async deleteClosedReservations(cutoff) {
      return deleteRows(
        `DELETE FROM reservations WHERE status IN ('EXPIRED', 'CANCELLED') AND reserved_until < $1`,
        [cutoff]
      );
    },

    // Delivered or failed notifications older than the cutoff (outbox is drained).
    async deleteDeliveredNotifications(cutoff) {
      return deleteRows(
        `DELETE FROM notifications WHERE status IN ('SENT', 'FAILED') AND created_at < $1`,
        [cutoff]
      );
    },

    // Revoked or expired access sessions older than the cutoff.
    async deleteExpiredSessions(cutoff) {
      return deleteRows(
        `DELETE FROM access_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < $1) OR expires_at < $1`,
        [cutoff]
      );
    },

    // Closed offers older than the cutoff (never accepted, so never referenced by an acquisition).
    async deleteClosedOffers(cutoff) {
      return deleteRows(
        `DELETE FROM offers WHERE status IN ('EXPIRED', 'REJECTED', 'WITHDRAWN') AND expires_at < $1`,
        [cutoff]
      );
    }
  });
}