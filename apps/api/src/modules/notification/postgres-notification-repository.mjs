export function createPostgresNotificationRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  function row(r) {
    return Object.freeze({
      id: r.id,
      userId: r.user_id,
      channel: r.channel,
      notificationType: r.notification_type,
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      status: r.status,
      payloadSnapshot: r.payload_snapshot,
      scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
      sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null
    });
  }

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO notifications(id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7::jsonb, $8)
         ON CONFLICT (id) DO NOTHING
         RETURNING id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at, sent_at`,
        [record.id, record.userId, record.channel, record.notificationType, record.referenceType, record.referenceId, record.payloadSnapshot == null ? null : JSON.stringify(record.payloadSnapshot), record.scheduledAt]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async markSent(id, now) {
      const result = await pool.query(
        `UPDATE notifications SET status = 'SENT', sent_at = $2
         WHERE id = $1 AND status = 'PENDING'
         RETURNING id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at, sent_at`,
        [id, now]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async markFailed(id) {
      const result = await pool.query(
        `UPDATE notifications SET status = 'FAILED'
         WHERE id = $1 AND status = 'PENDING'
         RETURNING id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at, sent_at`,
        [id]
      );
      return result.rows[0] ? row(result.rows[0]) : null;
    },

    async list() {
      const result = await pool.query(
        `SELECT id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at, sent_at
         FROM notifications ORDER BY created_at DESC LIMIT 100`,
        []
      );
      return result.rows.map(row);
    },

    async listPending(limit = 20) {
      const result = await pool.query(
        `SELECT id, user_id, channel, notification_type, reference_type, reference_id, status, payload_snapshot, scheduled_at, sent_at
         FROM notifications WHERE status = 'PENDING' AND (scheduled_at IS NULL OR scheduled_at <= now()) ORDER BY created_at ASC LIMIT $1`,
        [limit]
      );
      return result.rows.map(row);
    }
  });
}
