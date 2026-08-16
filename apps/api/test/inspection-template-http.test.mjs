import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { InspectionTemplateError } from "../src/modules/inspection/inspection-template-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async list() { return [{ id: "t1" }]; },
    async get() { return { id: "t1", items: [] }; },
    async create() { return { template: { id: "t1" }, items: [] }; },
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, inspectionTemplateService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-insp", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ inspectionTemplateService, allowedOrigins })(request, response);
  return result;
}

test("inspection template list requires categoryId and get is read-only", async () => {
  assert.equal((await invoke("/api/v1/admin/inspection-templates?categoryId=gpu")).status, 200);
  assert.equal((await invoke("/api/v1/admin/inspection-templates")).status, 400);
  assert.equal((await invoke("/api/v1/admin/inspection-templates/t1")).status, 200);
});

test("inspection template create requires CSRF and returns 201", async () => {
  const missingCsrf = await invoke("/api/v1/admin/inspection-templates", { method: "POST", body: { categoryId: "gpu", name: "G", version: "1", items: [] } });
  assert.equal(missingCsrf.status, 403);

  const response = await invoke("/api/v1/admin/inspection-templates", {
    method: "POST",
    body: { categoryId: "gpu", name: "G", version: "1", items: [{ code: "a", label: "A", resultType: "NUMBER" }] },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 201);
});

test("inspection template maps conflict and bad references", async () => {
  const conflict = await invoke("/api/v1/admin/inspection-templates", {
    method: "POST",
    body: { categoryId: "gpu", name: "G", version: "1", items: [{ code: "a", label: "A", resultType: "NUMBER" }] },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    inspectionTemplateService: service({ async create() { throw new InspectionTemplateError("conflict"); } })
  });
  assert.equal(conflict.status, 409);

  const invalidRef = await invoke("/api/v1/admin/inspection-templates", {
    method: "POST",
    body: { categoryId: "missing", name: "G", version: "1", items: [{ code: "a", label: "A", resultType: "NUMBER" }] },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    inspectionTemplateService: service({ async create() { throw new InspectionTemplateError("invalid_reference"); } })
  });
  assert.equal(invalidRef.status, 422);
});

test("inspection template route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/inspection-templates/t1", { method: "PATCH" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/inspection-templates?categoryId=gpu", { inspectionTemplateService: null })).status, 503);
});
