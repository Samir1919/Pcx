import test from "node:test";
import assert from "node:assert/strict";
import { shipmentApi } from "../lib/shipment-api.js";

test("shipment writes use correct paths and never send client-owned tracking id", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_csrf=secure" };
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); return { ok: true, status: 200, async json() { return { data: {} }; } }; };
  try {
    await shipmentApi.create({ orderId: "o1", courier: "sandbox" });
    await shipmentApi.ship("shp-1", { recipientName: "A", phone: "1", line1: "L", city: "C" });
    await shipmentApi.deliver("shp-1");

    assert.equal(calls[0][0], "/api/v1/admin/shipments");
    assert.equal(calls[1][0], "/api/v1/admin/shipments/shp-1/ship");
    assert.equal(calls[2][0], "/api/v1/admin/shipments/shp-1/deliver");

    const createBody = JSON.parse(calls[0][1].body);
    assert.equal(createBody.trackingId, undefined);
    assert.equal(createBody.status, undefined);

    const shipBody = JSON.parse(calls[1][1].body);
    assert.equal(shipBody.address.recipientName, "A");
    assert.equal(shipBody.trackingId, undefined);
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
