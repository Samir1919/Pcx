import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { SellTaxonomyError } from "../src/modules/catalog/sell-taxonomy-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async publicTaxonomy() { return { data: [{ entryKey: "DESKTOP_PC", kind: "BUILD", category: { id: "c1", name: "Desktop PC", slug: "desktop-pc" }, components: [], children: [] }] }; },
    async listAdmin() { return { data: [] }; },
    async updateEntry() { return { entryKey: "DESKTOP_PC" }; },
    async updateComponent() { return { entryKey: "DESKTOP_PC", role: "gpu" }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, sellTaxonomyService = service(), allowedOrigins = new Set([origin]) } = {}) {
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

test("admin list is read-only", async () => {
  assert.equal((await invoke("/api/v1/admin/sell-entry-config")).status, 200);
  assert.equal((await invoke("/api/v1/admin/sell-entry-config", { method: "POST", body: {} })).status, 405);
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
