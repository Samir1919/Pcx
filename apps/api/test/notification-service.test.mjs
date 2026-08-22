import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationService } from "../src/modules/notification/notification-service.mjs";
import { NotificationChannel, NotificationStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { creates: [], sent: [], failed: [] };
  const repository = {
    async create(record) { calls.creates.push(record); return record; },
    async markSent(id, now) { calls.sent.push(id); return { id, status: NotificationStatus.SENT }; },
    async markFailed(id) { calls.failed.push(id); return { id, status: NotificationStatus.FAILED }; },
    async listPending() { return []; },
    async list() { return []; },
    ...overrides.repository
  };
  const service = createNotificationService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["SUPER_ADMIN"] }; }, ...overrides.authService },
    repository,
    dispatchers: { EMAIL: { async send() { } }, SMS: { async send() { throw new Error("provider down"); } } }
  });
  return { service, calls };
}

test("notification create requires SYSTEM_CONFIGURE and stores PENDING", async () => {
  const { service, calls } = fixture();
  const n = await service.create("access", { userId: "u1", channel: NotificationChannel.EMAIL, notificationType: "ORDER_CONFIRMED", payloadSnapshot: { order: 1 } });
  assert.equal(n.status, NotificationStatus.PENDING);
  assert.equal(calls.creates.length, 1);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.create("access", { channel: "EMAIL", notificationType: "T" }), (error) => error.code === "forbidden");
});

test("dispatchDue marks sent on success and failed on provider error, never rolls back", async () => {
  const pending = [
    { id: "a", channel: NotificationChannel.EMAIL, notificationType: "T" },
    { id: "b", channel: NotificationChannel.SMS, notificationType: "T" }
  ];
  const { service, calls } = fixture({ repository: { async listPending() { return pending; }, async markSent(id) { calls.sent.push(id); return { id, status: "SENT" }; }, async markFailed(id) { calls.failed.push(id); return { id, status: "FAILED" }; } } });
  const results = await service.dispatchDue();
  assert.deepEqual(results, [{ id: "a", status: "SENT" }, { id: "b", status: "FAILED" }]);
  assert.deepEqual(calls.sent, ["a"]);
  assert.deepEqual(calls.failed, ["b"]);
});
