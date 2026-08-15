import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ReturnRequestError } from "../src/modules/warranty/return-request-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async create() { return { id: "r1", status: "REQUESTED" }; },
    async approve() { return { id: "r1", status: "APPROVED" }; },
    async receive() { return { id: "r1", status: "RECEIVED" }; },
    async settleRefund() { return { id: "r1", status: "REFUNDED", resolutionAmount: 1000 }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, returnRequestService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-ret", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ returnRequestService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("return create requires CSRF and maps conflict/state to 409", async () => {
  const noCsrf = await invoke("/api/v1/returns", { body: { orderItemId: "oi1", reasonCode: "DOA" } });
  assert.equal(noCsrf.status, 403);

  const response = await invoke("/api/v1/returns", { body: { orderItemId: "oi1", reasonCode: "DOA" }, headers: csrf() });
  assert.equal(response.status, 201);

  const conflict = await invoke("/api/v1/returns", { body: { orderItemId: "oi1", reasonCode: "DOA" }, headers: csrf(), returnRequestService: service({ async create() { throw new ReturnRequestError("conflict"); } }) });
  assert.equal(conflict.status, 409);

  const invalidState = await invoke("/api/v1/returns/r1/approve", { headers: csrf(), returnRequestService: service({ async approve() { throw new ReturnRequestError("invalid_state"); } }) });
  assert.equal(invalidState.status, 409);
});

test("return approve/receive/refund routes are wired", async () => {
  assert.equal((await invoke("/api/v1/returns/r1/approve", { body: {}, headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/returns/r1/receive", { body: {}, headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/returns/r1/refund", { body: { amount: 1000 }, headers: csrf() })).status, 200);

  const badAmount = await invoke("/api/v1/returns/r1/refund", { body: { amount: -1 }, headers: csrf() });
  assert.equal(badAmount.status, 422);
});

test("return route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/returns", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/returns", { body: {}, returnRequestService: null })).status, 503);
});
