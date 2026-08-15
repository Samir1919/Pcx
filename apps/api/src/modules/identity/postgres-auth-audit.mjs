import { randomUUID } from "node:crypto";

function bounded(value, name, maximum, fallback = null) {
  if (value == null && fallback != null) return fallback;
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) throw new TypeError(`${name} is invalid`);
  return value;
}

function canonical(value, name) {
  const checked = bounded(value, name, 64);
  if (!/^[a-z][a-z0-9_]*$/.test(checked)) throw new TypeError(`${name} is invalid`);
  return checked.toUpperCase();
}

export function createPostgresAuthAudit({ pool, id = randomUUID }) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool is required");
  return Object.freeze({
    async record({ action, outcome, subjectId, requestId, occurredAt }) {
      const eventAction = `AUTH_${canonical(action, "action")}_${canonical(outcome, "outcome")}`;
      const targetId = bounded(subjectId, "subjectId", 128, "anonymous");
      const correlation = bounded(requestId, "requestId", 128, "unavailable");
      const timestamp = new Date(occurredAt);
      if (Number.isNaN(timestamp.getTime())) throw new TypeError("occurredAt is invalid");
      await pool.query(
        "INSERT INTO auth_audit_events(id, actor_id, action, target_type, target_id, request_id, changes, occurred_at) VALUES ($1, NULL, $2, 'USER', $3, $4, $5::jsonb, $6)",
        [id(), eventAction, targetId, correlation, JSON.stringify({ outcome: outcome.toUpperCase() }), timestamp.toISOString()]
      );
    }
  });
}
