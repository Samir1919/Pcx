import test from "node:test";
import assert from "node:assert/strict";
import { acquisitionApi } from "../lib/acquisition-api.js";

test("acquisition writes use correct paths and never send server-owned agreed price", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_csrf=secure" };
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); return { ok: true, status: 201, async json() { return { data: {} }; } }; };
  try {
    await acquisitionApi.createValuation({ sellRequestId: "sr-1", valuationType: "PRELIMINARY" });
    await acquisitionApi.createOffer({ sellRequestId: "sr-1", amount: 5000 });
    await acquisitionApi.acceptOffer("offer-1");
    await acquisitionApi.createAcquisition({ sellRequestId: "sr-1", acceptedOfferId: "offer-1", sourceType: "SELL_TO_PCX", idempotencyKey: "k1" });
    await acquisitionApi.markAcquisitionPaid("acq-1");

    assert.equal(calls[0][0], "/api/v1/admin/valuations");
    assert.equal(calls[1][0], "/api/v1/admin/offers");
    assert.equal(calls[2][0], "/api/v1/admin/offers/offer-1/accept");
    assert.equal(calls[3][0], "/api/v1/admin/acquisitions");
    assert.equal(calls[4][0], "/api/v1/admin/acquisitions/acq-1/pay");

    for (const [, options] of calls) {
      assert.equal(options.credentials, "include");
      assert.equal(options.headers["x-csrf-token"], "secure");
    }

    const acquisitionBody = JSON.parse(calls[3][1].body);
    assert.equal(acquisitionBody.agreedPrice, undefined);
    assert.equal(acquisitionBody.status, undefined);
    assert.equal(acquisitionBody.idempotencyKey, "k1");
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
