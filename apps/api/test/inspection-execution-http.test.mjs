import test from "node:test";
import assert from "node:assert/strict";
import { handleInspectionExecutionRequest } from "../src/modules/inspection/inspection-execution-http.mjs";

function responseSpy() {
  let status = 0;
  let body = null;
  return {
    writeHead(code) { status = code; return { end(payload) { body = payload == null ? null : JSON.parse(payload); } }; },
    end() { },
    getStatus: () => status,
    getBody: () => body
  };
}

const allowedOrigins = new Set(["http://localhost:3001"]);
const writeHeaders = { origin: "http://localhost:3001", "x-csrf-token": "abc", cookie: "pcx_csrf=abc; pcx_access=tok" };

function request(path, method = "GET", { body, headers = {} } = {}) {
  return {
    url: `http://pcx.local${path}`,
    method,
    headers: { "content-type": "application/json", ...headers },
    async *[Symbol.asyncIterator]() { if (body != null) yield JSON.stringify(body); }
  };
}

function service() {
  return {
    start: async () => ({ id: "insp-1", status: "DRAFT" }),
    list: async () => [],
    get: async () => ({ id: "insp-1", results: [], healthScore: null }),
    putResult: async () => ({ id: "r-1", resultStatus: "PASS" }),
    submit: async () => ({ id: "insp-1", status: "SUBMITTED" }),
    approve: async () => ({ id: "insp-1", status: "APPROVED" }),
    reject: async () => ({ id: "insp-1", status: "REJECTED" })
  };
}

test("POST /api/v1/inspections starts an inspection", async () => {
  const res = responseSpy();
  await handleInspectionExecutionRequest(request("/api/v1/inspections", "POST", { body: { inventoryItemId: "item-1", inspectionTemplateId: "tpl" }, headers: writeHeaders }), res, { inspectionExecutionService: service(), allowedOrigins, requestId: "r" });
  assert.equal(res.getStatus(), 201);
  assert.equal(res.getBody().data.status, "DRAFT");
});

test("GET /api/v1/inspections requires inventoryItemId", async () => {
  const res = responseSpy();
  await handleInspectionExecutionRequest(request("/api/v1/inspections", "GET"), res, { inspectionExecutionService: service(), allowedOrigins, requestId: "r" });
  assert.equal(res.getStatus(), 400);
});

test("POST /api/v1/inspections/:id/submit submits", async () => {
  const res = responseSpy();
  await handleInspectionExecutionRequest(request("/api/v1/inspections/insp-1/submit", "POST", { headers: writeHeaders }), res, { inspectionExecutionService: service(), allowedOrigins, requestId: "r" });
  assert.equal(res.getStatus(), 200);
  assert.equal(res.getBody().data.status, "SUBMITTED");
});

test("write requires CSRF and origin", async () => {
  const res = responseSpy();
  await handleInspectionExecutionRequest(request("/api/v1/inspections", "POST", { body: { inventoryItemId: "x", inspectionTemplateId: "y" } }), res, { inspectionExecutionService: service(), allowedOrigins, requestId: "r" });
  assert.equal(res.getStatus(), 403);
});

test("non-matching path returns false", async () => {
  const res = responseSpy();
  const handled = await handleInspectionExecutionRequest(request("/api/v1/other"), res, { inspectionExecutionService: service(), allowedOrigins, requestId: "r" });
  assert.equal(handled, false);
});
