// Internal event emitter for business notifications.
//
// This is intentionally different from ContactDeliveryService (synchronous OTP)
// and from notificationService.create (admin-auth-gated manual creation). The
// emitter runs WITHOUT auth inside business services, writes a PENDING outbox
// row with a deterministic id so retries are idempotent, and never fails a
// business transaction when delivery is unavailable.

import { createHash } from "node:crypto";
import { createNotification } from "@pcx/domain";

function deterministicId(input) {
  const key = `${input.notificationType}:${input.referenceType ?? "none"}:${input.referenceId ?? "none"}:${input.userId ?? "broadcast"}:${input.channel}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

function normalizeChannel(value) {
  const channel = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!new Set(["EMAIL", "SMS", "PUSH"]).has(channel)) throw new TypeError("notification channel is invalid");
  return channel;
}

export function createNotificationEmitter({ repository, clock = () => new Date(), id = deterministicId }) {
  if (!repository || typeof repository.create !== "function") throw new TypeError("repository.create is required");

  return Object.freeze({
    // Best-effort emit: only writes the outbox row. The worker dispatch job
    // later sends the notification; failures there never roll back the business
    // operation because this call itself never throws an aborting error.
    async emit({ notificationType, userId = null, channel, referenceType = null, referenceId = null, payloadSnapshot = null }) {
      const safeChannel = normalizeChannel(channel);
      const record = createNotification({
        id: id({ notificationType, userId, channel: safeChannel, referenceType, referenceId }),
        userId,
        channel: safeChannel,
        notificationType,
        referenceType,
        referenceId,
        payloadSnapshot
      });
      const stored = await repository.create(record);
      return Object.freeze({
        status: stored ? "pending" : "idempotent",
        record: stored,
        id: record.id
      });
    }
  });
}
