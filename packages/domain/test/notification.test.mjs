import assert from "node:assert/strict";
import test from "node:test";
import { createNotification, markNotificationFailed, markNotificationSent, NotificationChannel, NotificationStatus } from "../src/index.mjs";

test("notification is PENDING with a valid channel and payload snapshot", () => {
  const n = createNotification({ id: "n1", userId: "u1", channel: NotificationChannel.EMAIL, notificationType: "ORDER_CONFIRMED", referenceType: "order", referenceId: "o1", payloadSnapshot: { orderNo: "ORD-1" } });
  assert.equal(n.status, NotificationStatus.PENDING);
  assert.equal(n.payloadSnapshot.orderNo, "ORD-1");
  assert.throws(() => createNotification({ id: "n", channel: "FAX", notificationType: "T" }), /channel/);
});

test("notification transitions PENDING→SENT or PENDING→FAILED", () => {
  const n = createNotification({ id: "n1", channel: NotificationChannel.SMS, notificationType: "ALERT" });
  const sent = markNotificationSent(n, { sentAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(sent.status, NotificationStatus.SENT);
  assert.equal(sent.sentAt, "2026-08-16T12:00:00.000Z");
  assert.throws(() => markNotificationSent(sent), /PENDING/);

  const n2 = createNotification({ id: "n2", channel: NotificationChannel.PUSH, notificationType: "ALERT" });
  const failed = markNotificationFailed(n2);
  assert.equal(failed.status, NotificationStatus.FAILED);
  assert.throws(() => markNotificationFailed(sent), /PENDING/);
});
