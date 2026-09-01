import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { ReportsError } from "../src/modules/reporting/operations-report-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async dashboard() { return { counts: { customers: 10 }, recentOrders: [], recentSellRequests: [] }; },
    async biDashboard() { return { counts: { customers: 10 }, revenue: { orderCount: 2 }, inventoryValue: [], inventoryCost: { totalCost: 0 } }; },
    async exportOperationsCsv() { return "metric,value\ncustomers,10"; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", operationsReportService = service() } = {}) {
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status, headers) { result.status = status; if (headers) result.headers = { ...result.headers, ...headers }; return response; },
    end(value) { result.body = value ? String(value) : undefined; return response; }
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

test("BI dashboard endpoint is a read-only GET", async () => {
  assert.equal((await invoke("/api/v1/admin/reports/bi")).status, 200);
  assert.equal((await invoke("/api/v1/admin/reports/bi", { method: "POST" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/reports/bi?x=1")).status, 400);
});

test("operations CSV export requires format=csv and returns text/csv", async () => {
  const ok = await invoke("/api/v1/admin/reports/operations/export?format=csv");
  assert.equal(ok.status, 200);
  assert.match(ok.headers["content-type"], /text\/csv/);
  assert.match(ok.body, /customers,10/);

  assert.equal((await invoke("/api/v1/admin/reports/operations/export")).status, 400);
  assert.equal((await invoke("/api/v1/admin/reports/operations/export?format=json")).status, 400);
});

test("operations report maps forbidden and missing service", async () => {
  const forbidden = await invoke("/api/v1/admin/reports/operations", { operationsReportService: service({ async dashboard() { throw new ReportsError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  assert.equal((await invoke("/api/v1/admin/reports/operations", { operationsReportService: null })).status, 503);
});
