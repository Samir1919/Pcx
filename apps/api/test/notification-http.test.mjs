import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { NotificationError } from "../src/modules/notification/notification-service.mjs";

function service(overrides = {}) {
  return {
    async create() { return { id: "n1", status: "PENDING" }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", cookie, body, notificationService = service() } = {}) {
  const serialized = JSON.stringify(body ?? {});
  const result = {};
  const response = {
    setHeader() { },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const headers = { "x-request-id": "req-notif" };
  if (cookie) headers.cookie = cookie;
  const request = {
    url: path,
    method,
    headers,
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { yield Buffer.from(serialized); }
  };
  await createRequestHandler({ notificationService })(request, response);
  return result;
}

test("notification create route is admin POST only", async () => {
  assert.equal((await invoke("/api/v1/admin/notifications", { body: { channel: "EMAIL", notificationType: "T" } })).status, 201);
  assert.equal((await invoke("/api/v1/admin/notifications", { method: "GET" })).status, 405);
  const invalid = await invoke("/api/v1/admin/notifications", { body: { channel: "FAX", notificationType: "T" }, notificationService: service({ async create(_cred, input) { if (input.channel === "FAX") throw new NotificationError("invalid_input"); return { id: "n1", status: "PENDING" }; } }) });
  assert.equal(invalid.status, 422);
});

test("notification create maps forbidden and missing service", async () => {
  const forbidden = await invoke("/api/v1/admin/notifications", { body: { channel: "EMAIL", notificationType: "T" }, notificationService: service({ async create() { throw new NotificationError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);
  assert.equal((await invoke("/api/v1/admin/notifications", { body: {}, notificationService: null })).status, 503);
});
