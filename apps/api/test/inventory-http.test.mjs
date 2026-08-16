import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { InventoryError } from "../src/modules/inventory/inventory-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async list() { return [{ id: "inv-1" }]; },
    async get() { return { id: "inv-1" }; },
    async intake() { return { item: { id: "inv-1" }, identifiers: [] }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, inventoryService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-inv", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ inventoryService, allowedOrigins })(request, response);
  return result;
}

test("inventory list and get are read-only and require no write security", async () => {
  assert.equal((await invoke("/api/v1/admin/inventory")).status, 200);
  assert.equal((await invoke("/api/v1/admin/inventory/inv-1")).status, 200);
});

test("inventory intake requires CSRF and returns 201 with duplicate mapped to 409", async () => {
  const missingCsrf = await invoke("/api/v1/admin/inventory", { method: "POST", body: { productModelId: "m" } });
  assert.equal(missingCsrf.status, 403);

  const response = await invoke("/api/v1/admin/inventory", {
    method: "POST",
    body: { productModelId: "m", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: true }] },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.item.id, "inv-1");

  const conflict = await invoke("/api/v1/admin/inventory", {
    method: "POST",
    body: { productModelId: "m", identifiers: [] },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    inventoryService: service({ async intake() { throw new InventoryError("duplicate_identifier"); } })
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "DUPLICATE_IDENTIFIER");
});

test("inventory route rejects unknown methods, services, and bad ids", async () => {
  assert.equal((await invoke("/api/v1/admin/inventory/inv-1", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/inventory", { inventoryService: null })).status, 503);
  assert.equal((await invoke("/api/v1/admin/inventory/bad%2Fid")).status, 404);
});
