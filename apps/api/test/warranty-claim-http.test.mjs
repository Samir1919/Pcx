import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";
import { WarrantyClaimError } from "../src/modules/warranty/warranty-claim-service.mjs";

const origin = "https://pcx.example";

function service(overrides = {}) {
  return {
    async createWarranty() { return { id: "w1", status: "ACTIVE" }; },
    async createClaim() { return { id: "c1", status: "REQUESTED" }; },
    async resolveClaim() { return { claim: { id: "c1", status: "RESOLVED" }, resolution: { id: "cr1" } }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body, headers = {}, warrantyClaimService = service(), allowedOrigins = new Set([origin]) } = {}) {
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
    headers: { origin, "content-type": "application/json", "x-request-id": "req-warr", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ warrantyClaimService, allowedOrigins })(request, response);
  return result;
}

function csrf() { return { cookie: "pcx_csrf=token", "x-csrf-token": "token" }; }

test("warranty/claims write endpoints require CSRF and return proper status", async () => {
  const noCsrf = await invoke("/api/v1/admin/warranties", { body: { orderItemId: "oi1", inventoryItemId: "inv-1", endsAt: "2027-08-16T00:00:00.000Z" } });
  assert.equal(noCsrf.status, 403);

  assert.equal((await invoke("/api/v1/admin/warranties", { body: { orderItemId: "oi1", inventoryItemId: "inv-1", endsAt: "2027-08-16T00:00:00.000Z" }, headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/claims", { body: { warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" }, headers: csrf() })).status, 201);
  assert.equal((await invoke("/api/v1/admin/claims/resolve", { body: { claimId: "c1", resolutionType: "REPLACE" }, headers: csrf() })).status, 200);
});

test("warranty/claims map forbidden and invalid state", async () => {
  const forbidden = await invoke("/api/v1/admin/warranties", { body: { orderItemId: "oi", inventoryItemId: "inv", endsAt: "2027-01-01T00:00:00.000Z" }, headers: csrf(), warrantyClaimService: service({ async createWarranty() { throw new WarrantyClaimError("forbidden"); } }) });
  assert.equal(forbidden.status, 403);

  const invalidState = await invoke("/api/v1/admin/claims/resolve", { body: { claimId: "c1", resolutionType: "REPLACE" }, headers: csrf(), warrantyClaimService: service({ async resolveClaim() { throw new WarrantyClaimError("invalid_state"); } }) });
  assert.equal(invalidState.status, 409);
});

test("warranty route rejects unknown methods and missing service", async () => {
  assert.equal((await invoke("/api/v1/admin/warranties", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/admin/warranties", { body: {}, warrantyClaimService: null })).status, 503);
});
