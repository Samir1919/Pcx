import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ReservationError } from "../src/modules/commerce/reservation-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async create() { return { id: "r1", status: "ACTIVE" }; },
    async convert() { return { id: "r1", status: "CONVERTED" }; },
    async active() { return null; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, reservationService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-res", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ reservationService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("reservation create requires CSRF and maps unavailable to 409", async () => {
  const noCsrf = await invoke("/api/v1/reservations", { method: "POST", body: { inventoryItemId: "inv-1" } });
  assert.equal(noCsrf.status, 403);

  assert.equal((await invoke("/api/v1/reservations", { method: "POST", body: { inventoryItemId: "inv-1" }, headers: csrf() })).status, 201);

  const unavailable = await invoke("/api/v1/reservations", { method: "POST", body: { inventoryItemId: "inv-1" }, headers: csrf(), reservationService: service({ async create() { throw new ReservationError("item_unavailable"); } }) });
  assert.equal(unavailable.status, 409);
  assert.equal(unavailable.body.error.code, "ITEM_UNAVAILABLE");
});

test("reservation active read and convert are routed correctly", async () => {
  assert.equal((await invoke("/api/v1/reservations/inv-1/active")).status, 200);
  assert.equal((await invoke("/api/v1/reservations/r1/convert", { method: "POST", headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/reservations/r1/convert", { method: "GET" })).status, 405);
});

test("reservation route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/reservations", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/reservations", { method: "POST", body: {}, reservationService: null })).status, 503);
});
