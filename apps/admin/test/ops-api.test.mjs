import test from "node:test";
import assert from "node:assert/strict";
import { opsApi } from "../lib/ops-api.js";

test("createTemplate posts typed items without server-owned status", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_admin_csrf=secure" };
  let call;
  global.fetch = async (...args) => { call = args; return { ok: true, status: 201, async json() { return { data: { id: "server-id", status: "ACTIVE" } }; } }; };
  try {
    const result = await opsApi.createTemplate({
      categoryId: "gpu",
      name: "GPU Check",
      version: "1.0",
      items: [{ code: "benchmark", label: "Benchmark", resultType: "PASS_FAIL", isMandatory: true, isCritical: false, sortOrder: 0 }]
    });
    assert.equal(result.data.status, "ACTIVE");
    assert.equal(call[0], "/api/v1/admin/inspection-templates");
    assert.equal(call[1].method, "POST");
    assert.equal(call[1].credentials, "include");
    assert.equal(call[1].headers["x-csrf-token"], "secure");
    const body = JSON.parse(call[1].body);
    assert.equal(body.status, undefined);
    assert.equal(body.items[0].resultType, "PASS_FAIL");
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});

test("inventory intake posts normalized identifiers without client-owned status", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_admin_csrf=secure" };
  let call;
  global.fetch = async (...args) => { call = args; return { ok: true, status: 201, async json() { return { data: { id: "server-id", status: "RECEIVED" } }; } }; };
  try {
    const result = await opsApi.intakeInventory({
      productModelId: "model-1",
      identifiers: [{ identifierType: "SERIAL", value: "ABC-123", isPrimary: true }]
    });
    assert.equal(result.data.status, "RECEIVED");
    assert.equal(call[0], "/api/v1/admin/inventory");
    assert.equal(call[1].method, "POST");
    assert.equal(call[1].credentials, "include");
    assert.equal(call[1].headers["x-csrf-token"], "secure");
    const body = JSON.parse(call[1].body);
    assert.equal(body.status, undefined);
    assert.equal(body.identifiers[0].identifierType, "SERIAL");
    assert.equal(body.identifiers[0].isPrimary, true);
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
