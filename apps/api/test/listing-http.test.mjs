import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ListingError } from "../src/modules/listing/listing-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async createDraft() { return { id: "l1", status: "DRAFT" }; },
    async publish() { return { id: "l1", status: "PUBLISHED" }; },
    async pause() { return { id: "l1", status: "PAUSED" }; },
    async unpublish() { return { id: "l1", status: "DRAFT" }; },
    async archive() { return { id: "l1", status: "ARCHIVED" }; },
    async setPrice() { return { id: "p1", price: 15000 }; },
    async listAdmin() { return { data: [{ id: "l1", modelName: "GPU" }], meta: { nextCursor: null } }; },
    async publicPassport() { return { pcxItemId: "PCX-1", status: "PUBLISHED" }; },
    async related() { return [{ pcxItemId: "PCX-2" }]; },
    async searchPublic() { return { data: [{ id: "l1", pcxItemId: "PCX-1" }], meta: { nextCursor: null } }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, listingService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-list", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ listingService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("public listing search requires GET and validates filters", async () => {
  assert.equal((await invoke("/api/v1/listings?categoryId=gpu&q=RTX")).status, 200);
  assert.equal((await invoke("/api/v1/listings", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/listings?unknown=1")).status, 400);
  assert.equal((await invoke("/api/v1/listings?limit=51")).status, 400);
  assert.equal((await invoke("/api/v1/listings?sort=cost_desc")).status, 400);
});

test("public passport is a read-only GET without write security", async () => {
  assert.equal((await invoke("/api/v1/passport/PCX-1")).status, 200);
  assert.equal((await invoke("/api/v1/passport/PCX-1", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/passport/PCX-1?x=1")).status, 400);
});

test("public related listings are a read-only GET", async () => {
  assert.equal((await invoke("/api/v1/passport/PCX-1/related")).status, 200);
  assert.equal((await invoke("/api/v1/passport/PCX-1/related", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/passport/PCX-1/related?x=1")).status, 400);
});

test("admin listing writes require CSRF and return success", async () => {
  const noCsrf = await invoke("/api/v1/admin/listings", { method: "POST", body: { inventoryItemId: "inv-1" } });
  assert.equal(noCsrf.status, 403);

  assert.equal((await invoke("/api/v1/admin/listings", { method: "POST", body: { inventoryItemId: "inv-1" }, headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/listings/l1/publish", { method: "POST", body: { publicSlug: "pcx-gaming-tower" }, headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/admin/listings/l1/pause", { method: "POST", headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/admin/listings/l1/unpublish", { method: "POST", headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/admin/listings/l1/archive", { method: "POST", headers: csrf() })).status, 200);
  assert.equal((await invoke("/api/v1/admin/listings/prices", { method: "POST", body: { listingId: "l1", price: 15000 }, headers: csrf() })).status, 201);
});

test("listing maps forbidden, conflict, and invalid state", async () => {
  const forbidden = await invoke("/api/v1/admin/listings", { method: "POST", body: { inventoryItemId: "inv-1" }, headers: csrf(), listingService: service({ async createDraft() { throw new ListingError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  const conflict = await invoke("/api/v1/admin/listings", { method: "POST", body: { inventoryItemId: "inv-1" }, headers: csrf(), listingService: service({ async createDraft() { throw new ListingError("conflict"); } }) });
  assert.equal(conflict.status, 409);

  const state = await invoke("/api/v1/admin/listings/l1/publish", { method: "POST", body: {}, headers: csrf(), listingService: service({ async publish() { throw new ListingError("invalid_state"); } }) });
  assert.equal(state.status, 409);
});

test("admin listing list is a permission-gated GET and rejects query params", async () => {
  assert.equal((await invoke("/api/v1/admin/listings")).status, 200);
  assert.equal((await invoke("/api/v1/admin/listings?x=1")).status, 400);
});

test("listing route rejects unsupported methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/listings", { method: "POST", body: {}, listingService: null })).status, 503);
});
