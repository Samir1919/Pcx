import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ScheduledExportError } from "../src/modules/reporting/scheduled-export-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async list() { return [{ id: "e1", name: "Daily ops", report: "operations" }]; },
    async create(body) { return { id: "e2", ...body }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, scheduledExportService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ scheduledExportService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("scheduled exports list is an admin GET", async () => {
  assert.equal((await invoke("/api/v1/admin/scheduled-exports")).status, 200);
  assert.equal((await invoke("/api/v1/admin/scheduled-exports?x=1")).status, 400);
  assert.equal((await invoke("/api/v1/admin/scheduled-exports", { method: "PUT" })).status, 405);
});

test("scheduled export create requires CSRF and returns 201", async () => {
  const noCsrf = await invoke("/api/v1/admin/scheduled-exports", { method: "POST", body: { name: "Ops", report: "operations", format: "csv", cadence: "daily" } });
  assert.equal(noCsrf.status, 403);

  const ok = await invoke("/api/v1/admin/scheduled-exports", { method: "POST", body: { name: "Ops", report: "operations", format: "csv", cadence: "daily" }, headers: csrf() });
  assert.equal(ok.status, 201);
});

test("scheduled export maps forbidden and missing service", async () => {
  const forbidden = await invoke("/api/v1/admin/scheduled-exports", { scheduledExportService: service({ async list() { throw new ScheduledExportError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  assert.equal((await invoke("/api/v1/admin/scheduled-exports", { scheduledExportService: null })).status, 503);
});