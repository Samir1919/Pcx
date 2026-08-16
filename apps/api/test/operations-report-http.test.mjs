import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ReportsError } from "../src/modules/reporting/operations-report-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async dashboard() { return { counts: { customers: 10 }, recentOrders: [], recentSellRequests: [] }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", operationsReportService = service() } = {}) {
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const request = {
    url: path,
    method,
    headers: { origin, "x-request-id": "req-rep" },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { }
  };
  await createRequestHandler({ operationsReportService })(request, response);
  return result;
}

test("operations report is a read-only GET returning dashboard data", async () => {
  assert.equal((await invoke("/api/v1/admin/reports/operations")).status, 200);
  assert.equal((await invoke("/api/v1/admin/reports/operations", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/reports/operations?x=1")).status, 400);
});

test("operations report maps forbidden and missing service", async () => {
  const forbidden = await invoke("/api/v1/admin/reports/operations", { operationsReportService: service({ async dashboard() { throw new ReportsError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  assert.equal((await invoke("/api/v1/admin/reports/operations", { operationsReportService: null })).status, 503);
});
