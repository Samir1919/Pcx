import assert from "node:assert/strict";
import test from "node:test";
import { IdentityActionError } from "../src/modules/identity/identity-action-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

const origin = "https://pcx.example";

function actionService(overrides = {}) {
  return {
    async verifyContact() { return { status: "verified" }; },
    async requestPasswordReset() { return { status: "accepted" }; },
    async resetPassword() { return { status: "reset" }; },
    ...overrides
  };
}

async function invoke(path, { body = {}, service = actionService(), headers = {} } = {}) {
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const payload = JSON.stringify(body);
  const request = {
    url: path, method: "POST", socket: { remoteAddress: "192.0.2.2" },
    headers: { origin, "content-type": "application/json", "x-request-id": "action-request", ...headers },
    async *[Symbol.asyncIterator]() { yield Buffer.from(payload); }
  };
  await createRequestHandler({ identityActionService: service, allowedOrigins: new Set([origin]) })(request, response);
  return result;
}

test("forgot-password is enumeration-safe and returns accepted only", async () => {
  const contacts = [];
  const service = actionService({ async requestPasswordReset(input) { contacts.push(input.contact); return { status: "accepted" }; } });
  for (const contact of ["known@example.com", "unknown@example.com"]) {
    const response = await invoke("/api/v1/auth/forgot-password", { body: { contact }, service });
    assert.equal(response.status, 202);
    assert.deepEqual(response.body, { data: { status: "accepted" } });
  }
  assert.deepEqual(contacts, ["known@example.com", "unknown@example.com"]);
});

test("verify-contact maps tokens without reflecting them", async () => {
  let token;
  const response = await invoke("/api/v1/auth/verify-contact", { body: { token: "restricted-token" }, service: actionService({ async verifyContact(input) { token = input.credential; return { status: "verified" }; } }) });
  assert.equal(response.status, 200);
  assert.equal(token, "restricted-token");
  assert.equal(JSON.stringify(response.body).includes("restricted-token"), false);
});

test("reset-password clears all browser credentials and returns no body", async () => {
  let input;
  const response = await invoke("/api/v1/auth/reset-password", { body: { token: "reset-token", password: "new-password-value" }, service: actionService({ async resetPassword(value) { input = value; return { status: "reset" }; } }) });
  assert.equal(response.status, 204);
  assert.equal(response.body, undefined);
  assert.deepEqual(input, { credential: "reset-token", password: "new-password-value" });
  assert.equal(response.headers["set-cookie"].every((cookie) => cookie.includes("Max-Age=0")), true);
});

test("invalid tokens, rate limits, fields, origins, and missing service fail closed", async () => {
  const invalid = await invoke("/api/v1/auth/verify-contact", { body: { token: "bad" }, service: actionService({ async verifyContact() { throw new IdentityActionError("invalid_token"); } }) });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "INVALID_TOKEN");
  assert.equal(JSON.stringify(invalid.body).includes("bad"), false);
  const limited = await invoke("/api/v1/auth/forgot-password", { body: { contact: "a@example.com" }, service: actionService({ async requestPasswordReset() { throw new IdentityActionError("rate_limited"); } }) });
  assert.equal(limited.status, 429);
  assert.equal((await invoke("/api/v1/auth/reset-password", { body: { token: "x", password: "y", role: "ADMIN" } })).status, 400);
  assert.equal((await invoke("/api/v1/auth/verify-contact", { body: { token: "x" }, headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await invoke("/api/v1/auth/forgot-password", { body: { contact: "x" }, service: null })).status, 503);
});
