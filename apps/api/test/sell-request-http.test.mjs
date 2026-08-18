import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { SellRequestError } from "../src/modules/acquisition/sell-request-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async list() { return [{ id: "sr-1", status: "DRAFT" }]; },
    async get() { return { id: "sr-1", status: "DRAFT" }; },
    async create() { return { id: "sr-1", status: "DRAFT" }; },
    async submit() { return { id: "sr-1", status: "SUBMITTED" }; },
    async listAdmin() { return { data: [] }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, sellRequestService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-sr", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ sellRequestService, allowedOrigins })(request, response);
  return result;
}

test("sell request list and get require no write security", async () => {
  assert.equal((await invoke("/api/v1/sell-requests")).status, 200);
  assert.equal((await invoke("/api/v1/sell-requests/sr-1")).status, 200);
});

test("admin sell request queue is read-only GET", async () => {
  assert.equal((await invoke("/api/v1/admin/sell-requests")).status, 200);
  assert.equal((await invoke("/api/v1/admin/sell-requests", { method: "POST" })).status, 405);
});

test("sell request create requires CSRF and origin and returns 201", async () => {
  const missingCsrf = await invoke("/api/v1/sell-requests", { method: "POST", body: { categoryId: "gpu" } });
  assert.equal(missingCsrf.status, 403);
  const response = await invoke("/api/v1/sell-requests", {
    method: "POST",
    body: { categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: "PICKUP", ownershipDeclared: true },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "DRAFT");
});

test("sell request submit enforces ownership and state, mapping invalid transition to 409", async () => {
  const response = await invoke("/api/v1/sell-requests/sr-1/submit", {
    method: "POST",
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "SUBMITTED");

  const conflict = await invoke("/api/v1/sell-requests/sr-1/submit", {
    method: "POST",
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    sellRequestService: service({ async submit() { throw new SellRequestError("invalid_state"); } })
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "STATE_TRANSITION_NOT_ALLOWED");
});

test("sell request route rejects unknown methods and bad paths", async () => {
  assert.equal((await invoke("/api/v1/sell-requests/sr-1", { method: "PATCH" })).status, 405);
  assert.equal((await invoke("/api/v1/sell-requests/extra/path")).status, 404);
  assert.equal((await invoke("/api/v1/sell-requests/sr-1/submit", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/sell-requests", { sellRequestService: null })).status, 503);
});
