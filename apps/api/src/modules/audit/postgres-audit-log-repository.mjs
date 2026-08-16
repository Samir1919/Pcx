export function createPostgresAuditLogRepository({ pool }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");

  function row(r) {
    return Object.freeze({
      id: String(r.id),
      actorUserId: r.actor_user_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      beforeSnapshot: r.before_snapshot,
      afterSnapshot: r.after_snapshot,
      reason: r.reason,
      ipAddress: r.ip_address,
      createdAt: new Date(r.created_at).toISOString()
    });
  }

  return Object.freeze({
    async create(record) {
      const result = await pool.query(
        `INSERT INTO audit_logs(actor_user_id, action, entity_type, entity_id, before_snapshot, after_snapshot, reason, ip_address)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::inet)
         RETURNING id, actor_user_id, action, entity_type, entity_id, before_snapshot, after_snapshot, reason, ip_address, created_at`,
        [record.actorUserId, record.action, record.entityType, record.entityId, record.beforeSnapshot == null ? null : JSON.stringify(record.beforeSnapshot), record.afterSnapshot == null ? null : JSON.stringify(record.afterSnapshot), record.reason ?? null, record.ipAddress ?? null]
      );
      return row(result.rows[0]);
    },

    async list({ entityType = null, entityId = null, limit = 50 } = {}) {
      const values = [];
      const where = [];
      const add = (v) => { values.push(v); return `$${values.length}`; };
      if (entityType) where.push(`entity_type = ${add(entityType)}`);
      if (entityId) where.push(`entity_id::text = ${add(entityId)}`);
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await pool.query(
        `SELECT id, actor_user_id, action, entity_type, entity_id, before_snapshot, after_snapshot, reason, ip_address, created_at
         FROM audit_logs ${clause} ORDER BY created_at DESC LIMIT $${values.length + 1}`,
        [...values, limit]
      );
      return result.rows.map(row);
    }
  });
}
