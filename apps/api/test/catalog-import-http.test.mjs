import assert from "node:assert/strict";
import test from "node:test";
import { CatalogImportError } from "../src/modules/catalog/catalog-import-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return { async importCsv() { return { created: 1, skipped: 0, errors: [] }; }, ...overrides };
}

async function invoke(path, { method = "POST", body = {}, headers = {}, catalogImportService = service() } = {}) {
  const result = { headers: {} };
  const response = {
    setHeader(n, v) { result.headers[n] = v; },
    writeHead(s) { result.status = s; return response; },
    end(v) { result.body = v ? JSON.parse(v) : undefined; return response; }
  };
  const payload = JSON.stringify(body);
  const request = {
    url: path, method, headers: { origin, "content-type": "application/json", cookie: "pcx_access=access; pcx_csrf=csrf", "x-csrf-token": "csrf", "x-request-id": "admin-request", ...headers },
    async *[Symbol.asyncIterator]() { if (payload) yield Buffer.from(payload); }
  };
  await createRequestHandler({ catalogImportService, allowedOrigins: new Set([origin]) })(request, response);
  return result;
}

test("catalog CSV import posts the CSV text to the import service", async () => {
  let call;
  const response = await invoke("/api/v1/admin/catalog/import", { body: { csv: "category,brand,name\nDesktop PC,PCX,PCX Gaming Tower" }, catalogImportService: service({ async importCsv(access, csv) { call = [access, csv]; return { created: 1, skipped: 0, errors: [] }; } }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.created, 1);
  assert.equal(call[0], "access");
  assert.equal(call[1], "category,brand,name\nDesktop PC,PCX,PCX Gaming Tower");
});

test("catalog CSV import fails closed for origin, CSRF, missing csv, and authz", async () => {
  assert.equal((await invoke("/api/v1/admin/catalog/import", { headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await invoke("/api/v1/admin/catalog/import", { headers: { "x-csrf-token": "bad" } })).status, 403);
  assert.equal((await invoke("/api/v1/admin/catalog/import", { body: {} })).status, 422);
  assert.equal((await invoke("/api/v1/admin/catalog/import", { body: { csv: "category,brand,name\nX,Y,Z" }, catalogImportService: service({ async importCsv() { throw new CatalogImportError("forbidden"); } }) })).status, 403);
  assert.equal((await invoke("/api/v1/admin/catalog/import", { catalogImportService: null })).status, 503);
  assert.equal((await invoke("/api/v1/admin/catalog/import", { method: "GET" })).status, 405);
});

test("catalog CSV import internal errors do not leak", async () => {
  const response = await invoke("/api/v1/admin/catalog/import", { body: { csv: "category,brand,name\nX,Y,Z" }, catalogImportService: service({ async importCsv() { throw new Error("database secret"); } }) });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response.body).includes("database secret"), false);
});