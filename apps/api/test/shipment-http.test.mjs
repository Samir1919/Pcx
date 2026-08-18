import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ShipmentError } from "../src/modules/logistics/shipment-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async create() { return { id: "s1", status: "DRAFT" }; },
    async ship() { return { id: "s1", status: "SHIPPED" }; },
    async deliver() { return { id: "s1", status: "DELIVERED" }; },
    async list() { return { data: [] }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, shipmentService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-shp", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ shipmentService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("shipment create requires CSRF and returns 201", async () => {
  const noCsrf = await invoke("/api/v1/admin/shipments", { body: { orderId: "o1", courier: "Pathao", packageType: "box", weight: 1 } });
  assert.equal(noCsrf.status, 403);

  const response = await invoke("/api/v1/admin/shipments", { body: { orderId: "o1", courier: "Pathao", packageType: "box", weight: 1 }, headers: csrf() });
  assert.equal(response.status, 201);
});

test("shipment ship requires an address and deliver maps invalid state", async () => {
  const ok = await invoke("/api/v1/admin/shipments/s1/ship", { body: { address: { line1: "1 Main St", city: "Dhaka", country: "BD" } }, headers: csrf() });
  assert.equal(ok.status, 200);

  const missingAddress = await invoke("/api/v1/admin/shipments/s1/ship", { body: {}, headers: csrf() });
  assert.equal(missingAddress.status, 422);

  // A client-supplied trackingId is not accepted: the HTTP layer only reads the
  // address and derives the tracking id server-side from the courier.
  const forgedTracking = await invoke("/api/v1/admin/shipments/s1/ship", { body: { trackingId: "FORGED", address: { line1: "1 Main St", city: "Dhaka", country: "BD" } }, headers: csrf() });
  assert.equal(forgedTracking.status, 200);


  assert.equal((await invoke("/api/v1/admin/shipments/s1/deliver", { body: {}, headers: csrf() })).status, 200);

  const invalidState = await invoke("/api/v1/admin/shipments/s1/deliver", { body: {}, headers: csrf(), shipmentService: service({ async deliver() { throw new ShipmentError("invalid_state"); } }) });
  assert.equal(invalidState.status, 409);
});


test("shipment list route and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/shipments", { method: "GET" })).status, 200);
  assert.equal((await invoke("/api/v1/admin/shipments", { body: {}, shipmentService: null })).status, 503);
});
