import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class AuditLogError extends Error {
  constructor(code) { super(code); this.name = "AuditLogError"; this.code = code; }
}

export function createAuditLogService({ authService, repository }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || typeof repository.list !== "function") throw new TypeError("repository.list is required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.AUDIT_READ)) throw new AuditLogError("forbidden");
    return identity;
  }

  return Object.freeze({
    async list(accessCredential, filters) {
      await actor(accessCredential);
      return Object.freeze(await repository.list(filters ?? {}));
    }
  });
}
