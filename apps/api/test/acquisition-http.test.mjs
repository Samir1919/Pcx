import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { AcquisitionError } from "../src/modules/acquisition/acquisition-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async createValuation() { return { id: "v1" }; },
    async createOffer() { return { id: "o1", status: "ACTIVE" }; },
    async acceptOffer() { return { id: "o1", status: "ACCEPTED" }; },
    async createAcquisition() { return { id: "a1", agreedPrice: 7000 }; },
    async markAcquisitionPaid() { return { id: "a1", paymentStatus: "PAID" }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, acquisitionService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-acq", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ acquisitionService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("acquisition endpoints require CSRF and return 201", async () => {
  const noCsrf = await invoke("/api/v1/admin/valuations", { body: { sellRequestId: "sr1", valuationType: "MANUAL" } });
  assert.equal(noCsrf.status, 403);

  assert.equal((await invoke("/api/v1/admin/valuations", { body: { sellRequestId: "sr1", valuationType: "MANUAL" }, headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/offers", { body: { sellRequestId: "sr1", valuationId: "v1", amount: 100, expiresAt: "2026-08-17T00:00:00.000Z" }, headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/offers/o1/accept", { headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/acquisitions", { body: { sellRequestId: "sr1", acceptedOfferId: "o1", sellerUserId: "u1", idempotencyKey: "idem-1" }, headers: csrf() })).status, 201);
});

test("acquisition maps forbidden, conflict, and invalid state", async () => {
  const forbidden = await invoke("/api/v1/admin/valuations", { body: { sellRequestId: "s", valuationType: "MANUAL" }, headers: csrf(), acquisitionService: service({ async createValuation() { throw new AcquisitionError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  const conflict = await invoke("/api/v1/admin/acquisitions", { body: { sellRequestId: "s", acceptedOfferId: "o", sellerUserId: "u", idempotencyKey: "k" }, headers: csrf(), acquisitionService: service({ async createAcquisition() { throw new AcquisitionError("conflict"); } }) });
  assert.equal(conflict.status, 409);

  const state = await invoke("/api/v1/admin/offers/o/accept", { headers: csrf(), acquisitionService: service({ async acceptOffer() { throw new AcquisitionError("invalid_state"); } }) });
  assert.equal(state.status, 409);
});

test("acquisition payment route requires CSRF and returns 201", async () => {
  const noCsrf = await invoke("/api/v1/admin/acquisitions/a1/pay");
  assert.equal(noCsrf.status, 403);

  const paid = await invoke("/api/v1/admin/acquisitions/a1/pay", { headers: csrf() });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.data.paymentStatus, "PAID");

  const state = await invoke("/api/v1/admin/acquisitions/a1/pay", { headers: csrf(), acquisitionService: service({ async markAcquisitionPaid() { throw new AcquisitionError("invalid_state"); } }) });
  assert.equal(state.status, 409);
});

test("acquisition route rejects GET and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/valuations", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/valuations", { method: "POST", body: {}, acquisitionService: null })).status, 503);
});
