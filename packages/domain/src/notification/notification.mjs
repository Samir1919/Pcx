export const NotificationChannel = Object.freeze({
  EMAIL: "EMAIL",
  SMS: "SMS",
  PUSH: "PUSH"
});

export const NotificationStatus = Object.freeze({
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED"
});

const channels = new Set(Object.values(NotificationChannel));
const statuses = new Set(Object.values(NotificationStatus));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

export function createNotification({
  id,
  userId = null,
  channel,
  notificationType,
  referenceType = null,
  referenceId = null,
  payloadSnapshot = null
}) {
  if (!channels.has(channel)) throw new TypeError("notification channel is invalid");
  return Object.freeze({
    id: requiredString(id, "id"),
    userId: optionalString(userId, "userId"),
    channel,
    notificationType: requiredString(notificationType, "notificationType"),
    referenceType: optionalString(referenceType, "referenceType"),
    referenceId: optionalString(referenceId, "referenceId"),
    status: NotificationStatus.PENDING,
    payloadSnapshot: payloadSnapshot == null ? null : Object.freeze(JSON.parse(JSON.stringify(payloadSnapshot))),
    scheduledAt: null,
    sentAt: null
  });
}

export function markNotificationSent(notification, { sentAt = new Date() } = {}) {
  if (!notification || typeof notification !== "object") throw new TypeError("notification is required");
  if (notification.status !== NotificationStatus.PENDING) throw new TypeError("only a PENDING notification can be sent");
  return Object.freeze({
    ...notification,
    status: NotificationStatus.SENT,
    sentAt: timestamp(sentAt, "sentAt")
  });
}

export function markNotificationFailed(notification) {
  if (!notification || typeof notification !== "object") throw new TypeError("notification is required");
  if (notification.status !== NotificationStatus.PENDING) throw new TypeError("only a PENDING notification can fail");
  return Object.freeze({ ...notification, status: NotificationStatus.FAILED });
}

export { channels as _channels, statuses as _statuses };
