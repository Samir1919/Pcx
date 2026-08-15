const auditableChangeKeys = new Set(["roles", "status", "contactVerified", "mfaRequired"]);

function safeChanges(changes = {}) {
  return Object.fromEntries(Object.entries(changes).filter(([key]) => auditableChangeKeys.has(key)));
}

export function createSecurityAuditEvent({ id, actorId, action, targetType, targetId, requestId, reason, changes, occurredAt = new Date() }) {
  for (const [name, value] of Object.entries({ id, actorId, action, targetType, targetId, requestId })) {
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  }
  return Object.freeze({
    id,
    actorId,
    action,
    targetType,
    targetId,
    requestId,
    reason: reason || null,
    changes: Object.freeze(safeChanges(changes)),
    occurredAt: occurredAt.toISOString()
  });
}
