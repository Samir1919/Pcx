import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { SellTaxonomyError } from "../src/modules/catalog/sell-taxonomy-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async publicTaxonomy() { return { data: [{ entryKey: "DESKTOP_PC", kind: "BUILD", category: { id: "c1", name: "Desktop PC", slug: "desktop-pc" }, components: [], children: [] }] }; },
    async listAdmin() { return { data: [] }; },
    async createEntry() { return { data: { entryKey: "MONITORS" } }; },
    async deleteEntry() { return { entryKey: "DESKTOP_PC" }; },
    async updateEntry() { return { entryKey: "DESKTOP_PC" }; },
    async updateComponent() { return { entryKey: "DESKTOP_PC", role: "gpu" }; },
    async createComponent() { return { entryKey: "DESKTOP_PC", role: "panel" }; },
    async deleteComponent() { return { entryKey: "DESKTOP_PC", role: "gpu" }; },
    async setEntryIcon() { return { entryKey: "DESKTOP_PC", iconMediaId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }; },
    async clearEntryIcon() { return { entryKey: "DESKTOP_PC", iconMediaId: null }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, rawBody, headers = {}, sellTaxonomyService = service(), allowedOrigins = new Set([origin]) } = {}) {
  const serialized = rawBody != null ? rawBody : (body == null ? "" : JSON.stringify(body));
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const request = {
    url: path,
    method,
    headers: { origin, "content-type": "application/json", "x-request-id": "req-st", ...headers },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ sellTaxonomyService, allowedOrigins })(request, response);
  return result;
}

test("public sell taxonomy is read-only", async () => {
  const ok = await invoke("/api/v1/sell-taxonomy");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data[0].entryKey, "DESKTOP_PC");
  assert.equal((await invoke("/api/v1/sell-taxonomy", { method: "POST", body: {} })).status, 405);
  assert.equal((await invoke("/api/v1/sell-taxonomy?x=1")).status, 400);
});

test("admin collection lists and creates entries", async () => {
  assert.equal((await invoke("/api/v1/admin/sell-entry-config")).status, 200);
  // POST without CSRF is rejected.
  assert.equal((await invoke("/api/v1/admin/sell-entry-config", { method: "POST", body: { categoryId: "c" } })).status, 403);
  // POST with CSRF creates an entry.
  const created = await invoke("/api/v1/admin/sell-entry-config", {
    method: "POST",
    body: { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "Sell a monitor", sortOrder: 50 },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.entryKey, "MONITORS");
});

test("admin create conflict maps to 409", async () => {
  const conflict = await invoke("/api/v1/admin/sell-entry-config", {
    method: "POST",
    body: { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "x", sortOrder: 50 },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    sellTaxonomyService: service({ async createEntry() { throw new SellTaxonomyError("already_exists"); } })
  });
  assert.equal(conflict.status, 409);
});

test("admin entry update requires CSRF", async () => {
  const missing = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC", { method: "PATCH", body: { hint: "New" } });
  assert.equal(missing.status, 403);

  const ok = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC", {
    method: "PATCH",
    body: { hint: "New" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(ok.status, 200);
});

test("admin component update requires CSRF", async () => {
  const ok = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/components/gpu", {
    method: "PATCH",
    body: { categoryId: "c-gpu" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(ok.status, 200);
});

test("admin entry delete and component create/delete routes", async () => {
  const del = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC", {
    method: "DELETE",
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(del.status, 200);

  const createComp = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/components", {
    method: "POST",
    body: { role: "panel", categoryId: "11111111-1111-1111-1111-111111111111" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(createComp.status, 201);
  assert.equal(createComp.body.data.role, "panel");

  const deleteComp = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/components/gpu", {
    method: "DELETE",
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(deleteComp.status, 200);
});

test("admin icon upload and revert routes", async () => {
  const upload = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/icon", {
    method: "POST",
    rawBody: Buffer.from("fake-image-bytes"),
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token", "content-type": "application/octet-stream" }
  });
  assert.equal(upload.status, 201);
  assert.equal(upload.body.data.iconMediaId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

  // Upload without CSRF is rejected.
  const noCsrf = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/icon", { method: "POST", rawBody: Buffer.from("x") });
  assert.equal(noCsrf.status, 403);

  const revert = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/icon", {
    method: "DELETE",
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(revert.status, 200);
  assert.equal(revert.body.data.iconMediaId, null);

  // Unsupported method on the icon route.
  assert.equal((await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC/icon", { method: "GET" })).status, 405);
});

test("admin errors map safely", async () => {
  const forbidden = await invoke("/api/v1/admin/sell-entry-config/DESKTOP_PC", {
    method: "PATCH",
    body: { hint: "x" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    sellTaxonomyService: service({ async updateEntry() { throw new SellTaxonomyError("forbidden"); } })
  });
  assert.equal(forbidden.status, 403);

  const nullService = await invoke("/api/v1/sell-taxonomy", { sellTaxonomyService: null });
  assert.equal(nullService.status, 503);
});
