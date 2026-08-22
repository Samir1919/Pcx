import { randomUUID } from "node:crypto";
import { authorizeRoleAssignment, createSecurityAuditEvent, hasPermission, Permission, Role } from "@pcx/domain";

export class UserAdminError extends Error {
  constructor(code) {
    super(code);
    this.name = "UserAdminError";
    this.code = code;
  }
}

const canonicalStatuses = new Set(["ACTIVE", "SUSPENDED", "DISABLED"]);

function requiredDependency(value, method, name) {
  if (!value || typeof value[method] !== "function") throw new TypeError(`${name}.${method} is required`);
}

export function createUserAdminService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  requiredDependency(authService, "authenticateAccess", "authService");
  for (const method of ["list", "findRoles", "findStatus", "updateStatus", "replaceRoles", "recordAudit", "disableRefreshSessions"]) {
    requiredDependency(repository, method, "repository");
  }

  async function authenticate(accessCredential, permission) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, permission)) throw new UserAdminError("forbidden");
    return identity;
  }

  function isSuperAdmin(roles) {
    return Array.isArray(roles) && roles.includes(Role.SUPER_ADMIN);
  }

  async function audit(actor, { action, targetId, requestId, reason = null, changes = {} }) {
    const event = createSecurityAuditEvent({
      id: id(),
      actorId: actor.userId,
      action,
      targetType: "User",
      targetId,
      requestId: requestId ?? "unavailable",
      reason,
      changes,
      occurredAt: clock()
    });
    await repository.recordAudit(event);
  }

  return Object.freeze({
    async list(accessCredential, filters, requestId) {
      const identity = await authenticate(accessCredential, Permission.IDENTITY_READ);
      const result = await repository.list(filters ?? {});
      return Object.freeze({
        data: Object.freeze(result.rows.map((row) => Object.freeze({ ...row, roles: Object.freeze([...row.roles]) }))),
        meta: Object.freeze({ nextCursor: result.nextCursor })
      });
    },

    async updateStatus(accessCredential, userId, status, requestId) {
      const identity = await authenticate(accessCredential, Permission.IDENTITY_MANAGE);
      if (!canonicalStatuses.has(status)) throw new UserAdminError("invalid_status");
      if (identity.userId === userId) throw new UserAdminError("self_change_blocked");

      const target = await repository.findRoles(userId);
      if (target === null) throw new UserAdminError("not_found");
      if (isSuperAdmin(target) && !isSuperAdmin(identity.roles)) throw new UserAdminError("super_admin_required");

      const updated = await repository.updateStatus({ userId, status, actorId: identity.userId, now: clock().toISOString() });
      if (!updated) throw new UserAdminError("not_found");

      if (status === "SUSPENDED" || status === "DISABLED") {
        await repository.disableRefreshSessions(userId, clock().toISOString());
      }
      await audit(identity, { action: "identity.status_changed", targetId: userId, requestId, changes: { status } });
      return Object.freeze(updated);
    },

    async replaceRoles(accessCredential, userId, roles, requestId) {
      const identity = await authenticate(accessCredential, Permission.ROLE_ASSIGN);
      const decision = authorizeRoleAssignment(identity, { targetUserId: userId, nextRoles: roles });
      if (!decision.allowed) throw new UserAdminError(decision.reason === "self_elevation_blocked" ? "self_change_blocked" : decision.reason === "super_admin_required" ? "super_admin_required" : "forbidden");

      const target = await repository.findRoles(userId);
      if (target === null) throw new UserAdminError("not_found");
      if (isSuperAdmin(target) && !isSuperAdmin(identity.roles)) throw new UserAdminError("super_admin_required");

      const assigned = await repository.replaceRoles({ userId, roles, actorId: identity.userId, now: clock().toISOString() });
      await audit(identity, { action: "identity.role_changed", targetId: userId, requestId, changes: { roles: assigned } });

      const fresh = await repository.findStatus(userId);
      return Object.freeze({ userId, status: fresh?.status ?? null, roles: Object.freeze([...assigned]) });
    }
  });
}
