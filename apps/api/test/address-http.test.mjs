import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError } from "../src/modules/identity/auth-service.mjs";
import { AddressError } from "../src/modules/identity/address-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

const origin = "https://pcx.example";
const address = { id: "a1", label: "Home", recipientName: "Buyer", phone: "017", addressLine1: "Road", addressLine2: null, area: "Area", city: "Dhaka", postalCode: null, isDefault: true, createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z" };

function service(overrides = {}) {
  return {
    async list() { return [address]; },
    async create() { return address; },
    async update() { return { ...address, label: "Office" }; },
    async delete() {},
    ...overrides
  };
}

async function invoke(path, { method = "GET", body, headers = {}, addressService = service(), allowedOrigins = new Set([origin]) } = {}) {
  const result = { headers: {} };
  const response = { setHeader(name, value) { result.headers[name] = value; }, writeHead(status) { result.status = status; return response; }, end(value) { result.body = value ? JSON.parse(value) : undefined; return response; } };
  const serialized = body === undefined ? "" : JSON.stringify(body);
  const request = {
    url: path, method,
    headers: { cookie: "pcx_access=access; pcx_csrf=csrf-token", origin, "x-csrf-token": "csrf-token", "content-type": "application/json", "x-request-id": "address-request", ...headers },
    async *[Symbol.asyncIterator]() { if (serialized) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ addressService, allowedOrigins })(request, response);
  return result;
}

test("address collection lists and creates through access credential", async () => {
  const calls = [];
  const addressService = service({ async list(access) { calls.push(["list", access]); return [address]; }, async create(access, input) { calls.push(["create", access, input]); return address; } });
  const listed = await invoke("/api/v1/me/addresses", { addressService });
  const created = await invoke("/api/v1/me/addresses", { method: "POST", body: { label: "Home" }, addressService });
  assert.equal(listed.status, 200);
  assert.equal(created.status, 201);
  assert.deepEqual(calls, [["list", "access"], ["create", "access", { label: "Home" }]]);
});

test("address item PATCH and DELETE preserve inaccessible-resource semantics", async () => {
  const calls = [];
  const addressService = service({ async update(access, id, input) { calls.push(["update", access, id, input]); return address; }, async delete(access, id) { calls.push(["delete", access, id]); } });
  assert.equal((await invoke("/api/v1/me/addresses/a1", { method: "PATCH", body: { label: "Office" }, addressService })).status, 200);
  assert.equal((await invoke("/api/v1/me/addresses/a1", { method: "DELETE", addressService })).status, 204);
  assert.deepEqual(calls, [["update", "access", "a1", { label: "Office" }], ["delete", "access", "a1"]]);
  const hidden = await invoke("/api/v1/me/addresses/other", { method: "DELETE", addressService: service({ async delete() { throw new AddressError("not_found"); } }) });
  assert.equal(hidden.status, 404);
});

test("address writes require exact origin and matching CSRF while reads do not", async () => {
  assert.equal((await invoke("/api/v1/me/addresses", { headers: { origin: "https://evil.example" } })).status, 200);
  assert.equal((await invoke("/api/v1/me/addresses", { method: "POST", body: {}, headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await invoke("/api/v1/me/addresses", { method: "POST", body: {}, headers: { "x-csrf-token": "wrong" } })).status, 403);
  assert.equal((await invoke("/api/v1/me/addresses", { method: "POST", body: {}, allowedOrigins: new Set() })).status, 403);
});

test("address errors and routing fail closed without leaking internals", async () => {
  const unauthenticated = await invoke("/api/v1/me/addresses", { addressService: service({ async list() { throw new AuthenticationError("invalid_access"); } }) });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await invoke("/api/v1/me/addresses", { method: "POST", body: { role: "ADMIN" }, addressService: service({ async create() { throw new AddressError("invalid_input"); } }) })).status, 422);
  assert.equal((await invoke("/api/v1/me/addresses/a1", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/me/addresses/a/b", { method: "DELETE" })).status, 404);
  assert.equal((await invoke("/api/v1/me/addresses", { addressService: null })).status, 503);
  const internal = await invoke("/api/v1/me/addresses", { addressService: service({ async list() { throw new Error("database secret"); } }) });
  assert.equal(internal.status, 500);
  assert.equal(JSON.stringify(internal.body).includes("database secret"), false);
});
