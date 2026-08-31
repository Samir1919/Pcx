import test from "node:test";
import assert from "node:assert/strict";
import { returnApi } from "../lib/return-api.js";

test("return admin actions use correct paths and refund body carries only amount", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_admin_csrf=secure" };
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); return { ok: true, status: 200, async json() { return { data: {} }; } }; };
  try {
    await returnApi.approve("ret-1");
    await returnApi.receive("ret-1");
    await returnApi.refund("ret-1", 500);

    assert.equal(calls[0][0], "/api/v1/returns/ret-1/approve");
    assert.equal(calls[1][0], "/api/v1/returns/ret-1/receive");
    assert.equal(calls[2][0], "/api/v1/returns/ret-1/refund");

    const refundBody = JSON.parse(calls[2][1].body);
    assert.equal(refundBody.amount, 500);
    assert.equal(refundBody.status, undefined);

    for (const [, options] of calls) {
      assert.equal(options.credentials, "include");
      assert.equal(options.headers["x-csrf-token"], "secure");
    }
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
