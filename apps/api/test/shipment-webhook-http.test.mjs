import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ShipmentError } from "../src/modules/logistics/shipment-service.mjs";

function service(overrides = {}) {
  return {
    async handleWebhook() { return { status: "applied", shipmentId: "s1" }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, shipmentService = service() } = {}) {
  const serialized = body == null ? "" : JSON.stringify(body);
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const request = {
    url: path,
    method,
    headers: { "content-type": "application/json", "x-request-id": "req-webhook", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ shipmentService })(request, response);
  return result;
}

test("courier webhook accepts a signed DELIVERED event", async () => {
  const response = await invoke("/api/v1/webhooks/courier", {
    body: { shipmentId: "s1", providerStatus: "DELIVERED" },
    headers: { "x-courier-signature": "secret" }
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "applied");
});

test("courier webhook rejects a missing signature via the service", async () => {
  const response = await invoke("/api/v1/webhooks/courier", {
    body: { shipmentId: "s1", providerStatus: "DELIVERED" },
    shipmentService: service({ async handleWebhook() { throw new ShipmentError("unauthorized"); } })
  });
  assert.equal(response.status, 401);
});


test("courier webhook rejects an invalid payload", async () => {
  const missing = await invoke("/api/v1/webhooks/courier", {
    body: { providerStatus: "DELIVERED" },
    headers: { "x-courier-signature": "secret" }
  });
  assert.equal(missing.status, 422);

  const badStatus = await invoke("/api/v1/webhooks/courier", {
    body: { shipmentId: "s1", providerStatus: "" },
    headers: { "x-courier-signature": "secret" }
  });
  assert.equal(badStatus.status, 422);
});

test("courier webhook rejects non-POST methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/webhooks/courier", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/webhooks/courier", { body: {}, shipmentService: null })).status, 503);
});

test("courier webhook maps an unauthorized service error to 401", async () => {
  const response = await invoke("/api/v1/webhooks/courier", {
    body: { shipmentId: "s1", providerStatus: "DELIVERED" },
    headers: { "x-courier-signature": "secret" },
    shipmentService: service({ async handleWebhook() { throw new ShipmentError("unauthorized"); } })
  });
  assert.equal(response.status, 401);
});
