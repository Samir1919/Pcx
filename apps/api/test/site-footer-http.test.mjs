import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { SiteFooterError } from "../src/modules/footer/site-footer-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async publicFooter() { return { data: { tagline: "T", linkColumns: [] } }; },
    async adminFooter() { return { data: { tagline: "T", linkColumns: [], isActive: true } }; },
    async save() { return { data: { tagline: "T" } }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, siteFooterService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-sf", ...headers },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ siteFooterService, allowedOrigins })(request, response);
  return result;
}

test("public footer is read-only GET without write security", async () => {
  assert.equal((await invoke("/api/v1/footer")).status, 200);
  assert.equal((await invoke("/api/v1/footer", { method: "POST", body: {} })).status, 405);
  assert.equal((await invoke("/api/v1/footer?x=1")).status, 400);
});

test("admin footer read is GET-gated", async () => {
  assert.equal((await invoke("/api/v1/admin/footer")).status, 200);
  assert.equal((await invoke("/api/v1/admin/footer", { method: "DELETE" })).status, 405);
});

test("admin footer write requires origin and double-submit CSRF", async () => {
  const missing = await invoke("/api/v1/admin/footer", { method: "PUT", body: { tagline: "X" } });
  assert.equal(missing.status, 403);

  const ok = await invoke("/api/v1/admin/footer", {
    method: "PUT",
    body: { tagline: "X" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(ok.status, 200);

  const badOrigin = await invoke("/api/v1/admin/footer", {
    method: "PUT",
    body: { tagline: "X" },
    headers: { origin: "https://evil.example", cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(badOrigin.status, 403);
});

test("admin errors map safely and missing service returns 503", async () => {
  const forbidden = await invoke("/api/v1/admin/footer", {
    method: "PUT",
    body: { tagline: "X" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    siteFooterService: service({ async save() { throw new SiteFooterError("forbidden"); } })
  });
  assert.equal(forbidden.status, 403);

  const nullService = await invoke("/api/v1/footer", { siteFooterService: null });
  assert.equal(nullService.status, 503);
});
