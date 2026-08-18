import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { IndicativePriceError } from "../src/modules/pricing/indicative-price-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async set() { return { id: "price-1", lowValue: 1000, highValue: 2000, status: "ACTIVE" }; },
    async listAdmin() { return { data: [] }; },
    async quote() { return { data: { range: null, productModelId: null, categoryId: null } }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, indicativePriceService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-price", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ indicativePriceService, allowedOrigins })(request, response);
  return result;
}

test("public quote range is read-only and rejects missing target", async () => {
  assert.equal((await invoke("/api/v1/quote-ranges?categoryId=c1")).status, 200);
  assert.equal((await invoke("/api/v1/quote-ranges", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/quote-ranges")).status, 400);
  assert.equal((await invoke("/api/v1/quote-ranges?unknown=1")).status, 400);
});

test("admin indicative price requires CSRF and returns 201", async () => {
  const missing = await invoke("/api/v1/admin/indicative-prices", { method: "POST", body: { categoryId: "c1", lowValue: 10, highValue: 20 } });
  assert.equal(missing.status, 403);

  const response = await invoke("/api/v1/admin/indicative-prices", {
    method: "POST",
    body: { categoryId: "c1", lowValue: 10, highValue: 20 },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "ACTIVE");
});

test("admin indicative price history is read-only GET", async () => {
  assert.equal((await invoke("/api/v1/admin/indicative-prices")).status, 200);
  assert.equal((await invoke("/api/v1/admin/indicative-prices", { method: "DELETE" })).status, 405);
});

test("admin errors map to safe responses", async () => {
  const forbidden = await invoke("/api/v1/admin/indicative-prices", {
    method: "POST",
    body: { categoryId: "c1", lowValue: 10, highValue: 20 },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    indicativePriceService: service({ async set() { throw new IndicativePriceError("forbidden"); } })
  });
  assert.equal(forbidden.status, 403);

  const nullService = await invoke("/api/v1/quote-ranges?categoryId=c1", { indicativePriceService: null });
  assert.equal(nullService.status, 503);
});
