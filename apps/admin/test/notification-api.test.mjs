import test from "node:test";
import assert from "node:assert/strict";
import { notificationApi } from "../lib/notification-api.js";

test("notification create posts allow-listed fields without server-owned status", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_csrf=secure" };
  let call;
  global.fetch = async (...args) => { call = args; return { ok: true, status: 201, async json() { return { data: { id: "n1", status: "PENDING" } }; } }; };
  try {
    const result = await notificationApi.create({
      userId: "u1",
      channel: "EMAIL",
      notificationType: "ORDER_SHIPPED",
      referenceType: "order",
      referenceId: "o1",
      payloadSnapshot: {},
      scheduledAt: null
    });
    assert.equal(result.data.status, "PENDING");
    assert.equal(call[0], "/api/v1/admin/notifications");
    assert.equal(call[1].method, "POST");
    assert.equal(call[1].credentials, "include");
    assert.equal(call[1].headers["x-csrf-token"], "secure");
    const body = JSON.parse(call[1].body);
    assert.equal(body.status, undefined);
    assert.equal(body.channel, "EMAIL");
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
