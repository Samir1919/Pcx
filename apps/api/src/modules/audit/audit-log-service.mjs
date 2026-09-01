import { hasPermission, Permission } from "@pcx/domain";

export class AuditLogError extends Error {
  constructor(code) { super(code); this.name = "AuditLogError"; this.code = code; }
}

export function createAuditLogService({ authService, repository }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || typeof repository.list !== "function" || typeof repository.create !== "function") throw new TypeError("repository.list and repository.create are required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.AUDIT_READ)) throw new AuditLogError("forbidden");
    return identity;
  }

  return Object.freeze({
    async list(accessCredential, filters) {
      await actor(accessCredential);
      return Object.freeze(await repository.list(filters ?? {}));
    },

    // Append-only audit write. No authorization is required here: the caller is
    // already inside a privileged service path and this never mutates business
    // state. Not exposed as a public endpoint.
    async record({ actorUserId, action, entityType, entityId, beforeSnapshot = null, afterSnapshot = null, reason = null }) {
      return repository.create({ actorUserId, action, entityType, entityId, beforeSnapshot, afterSnapshot, reason });
    },

    // External SIEM export: NDJSON (one JSON object per line) of the bounded
    // audit tail. Structured for syslog/SIEM ingestion without a schema change.
    async exportNdjson(accessCredential, filters) {
      await actor(accessCredential);
      const rows = await repository.exportAll(filters ?? {});
      return rows.map((r) => JSON.stringify(r)).join("\n");
    }
  });
}
