import test from "node:test";
import assert from "node:assert/strict";
import { warrantyApi } from "../lib/warranty-api.js";

test("warranty writes use correct paths and resolve body carries only typed fields", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_admin_csrf=secure" };
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); return { ok: true, status: 201, async json() { return { data: {} }; } }; };
  try {
    await warrantyApi.createWarranty({ orderItemId: "oi-1", inventoryItemId: "inv-1", policyId: "p-1", startsAt: "2026-08-18T00:00:00.000Z" });
    await warrantyApi.createClaim({ warrantyId: "w-1", orderItemId: "oi-1", reasonCode: "BROKEN" });
    await warrantyApi.resolveClaim({ claimId: "c-1", resolutionType: "REPLACE", notes: "x", costAmount: 500 });

    assert.equal(calls[0][0], "/api/v1/admin/warranties");
    assert.equal(calls[1][0], "/api/v1/admin/claims");
    assert.equal(calls[2][0], "/api/v1/admin/claims/resolve");

    const resolveBody = JSON.parse(calls[2][1].body);
    assert.equal(resolveBody.resolutionType, "REPLACE");
    assert.equal(resolveBody.costAmount, 500);
    assert.equal(resolveBody.status, undefined);
    assert.equal(resolveBody.approvedBy, undefined);
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
