import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError } from "../src/modules/identity/auth-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

async function invoke({ method = "GET", headers = {}, authService } = {}) {
  const result = { headers: {} };
  const response = { setHeader(name, value) { result.headers[name] = value; }, writeHead(status) { result.status = status; return response; }, end(body) { result.body = body ? JSON.parse(body) : undefined; return response; } };
  await createRequestHandler({ authService })({ url: "/api/v1/me", method, headers }, response);
  return result;
}

test("self endpoint authenticates access cookie and returns only service DTO", async () => {
  let credential;
  const response = await invoke({ headers: { cookie: "other=x; pcx_access=raw%2Daccess" }, authService: { async authenticateAccess(input) { credential = input.accessCredential; return { userId: "u1", status: "ACTIVE", contactVerified: true, roles: ["CUSTOMER"] }; } } });
  assert.equal(response.status, 200);
  assert.equal(credential, "raw-access");
  assert.deepEqual(response.body.data, { userId: "u1", status: "ACTIVE", contactVerified: true, roles: ["CUSTOMER"] });
});

test("self endpoint fails closed for absent/invalid access, methods, and service", async () => {
  const invalidService = { async authenticateAccess() { throw new AuthenticationError("invalid_access"); } };
  for (const headers of [{}, { cookie: "pcx_access=bad" }]) assert.equal((await invoke({ headers, authService: invalidService })).status, 401);
  assert.equal((await invoke({ method: "POST", authService: invalidService })).status, 405);
  assert.equal((await invoke()).status, 503);
  const internal = await invoke({ authService: { async authenticateAccess() { throw new Error("database secret"); } } });
  assert.equal(internal.status, 500);
  assert.equal(JSON.stringify(internal.body).includes("database secret"), false);
});
