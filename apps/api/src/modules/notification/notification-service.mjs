import { createNotification, markNotificationSent, markNotificationFailed } from "@pcx/domain";
import { hasPermission, Permission } from "@pcx/domain";

export class NotificationError extends Error {
  constructor(code) { super(code); this.name = "NotificationError"; this.code = code; }
}

const createFields = new Set(["userId", "channel", "notificationType", "referenceType", "referenceId", "payloadSnapshot", "scheduledAt"]);

export function createNotificationService({ authService, repository, dispatchers = {} }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "markSent", "markFailed", "listPending", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new NotificationError("forbidden");
    return identity;
  }

  async function reader(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE) && !hasPermission(identity, Permission.AUDIT_READ)) throw new NotificationError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new NotificationError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async create(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, createFields);
      let record;
      try {
        record = createNotification({
          id: (input?.id) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...fields,
          scheduledAt: fields.scheduledAt ?? null
        });
      } catch {
        throw new NotificationError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(record));
      } catch (error) {
        if (error?.code === "23503") throw new NotificationError("invalid_reference");
        throw error;
      }
    },

    async list(accessCredential) {
      await reader(accessCredential);
      if (typeof repository.list !== "function") throw new NotificationError("invalid_state");
      return Object.freeze({ data: Object.freeze(await repository.list()) });
    },

    async dispatchDue({ limit = 20 } = {}) {
      const pending = await repository.listPending(limit);
      const results = [];
      for (const notification of pending) {
        const dispatcher = dispatchers[notification.channel];
        if (!dispatcher || typeof dispatcher.send !== "function") continue; // leave PENDING for a configured dispatcher
        try {
          await dispatcher.send(notification);
          const sent = await repository.markSent(notification.id, new Date().toISOString());
          results.push({ id: notification.id, status: sent?.status ?? "SENT" });
        } catch {
          const failed = await repository.markFailed(notification.id);
          results.push({ id: notification.id, status: failed?.status ?? "FAILED" });
        }
      }
      return Object.freeze(results);
    }
  });
}
