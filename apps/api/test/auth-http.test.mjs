import assert from "node:assert/strict";
import test from "node:test";

// Secure-cookie expectation is the production trust boundary. Evaluate the
// source with NODE_ENV=production so a local `development` environment never
// makes this regression test pass/fail depending on where it runs.
process.env.NODE_ENV = "production";
const [{ AuthenticationError }, { createRequestHandler }] = await Promise.all([
  import("../src/modules/identity/auth-service.mjs"),
  import("../src/server.mjs")
]);

const origin = "https://pcx.example";
const session = Object.freeze({
  accessCredential: "raw-access",
  refreshCredential: "raw-refresh",
  accessExpiresAt: "2027-01-01T00:15:00.000Z",
  refreshExpiresAt: "2027-01-31T00:00:00.000Z"
});

function service(overrides = {}) {
  return {
    async register() { return { customer: { id: "customer-1", status: "PENDING_VERIFICATION", contactVerified: false } }; },
    async login() { return { identity: { userId: "customer-1", roles: ["CUSTOMER"] }, session }; },
    async refresh() { return { status: "refreshed", session }; },
    async logout() { return { status: "logged_out" }; },
    ...overrides
  };
}

async function invoke(path, { method = "POST", body = {}, headers = {}, authService = service(), identityActionService, allowedOrigins = new Set([origin]) } = {}) {
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(value) { result.body = value ? JSON.parse(value) : undefined; return response; }
  };
  const request = {
    url: path,
    method,
    headers: { origin, "content-type": "application/json", "x-request-id": "req-auth", ...headers },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { if (serialized.length > 0) yield Buffer.from(serialized); }
  };
  await createRequestHandler({ authService, identityActionService, allowedOrigins })(request, response);
  return result;
}

test("registration accepts only bounded documented JSON and returns safe identity data", async () => {
  const input = [];
  const response = await invoke("/api/v1/auth/register", { body: { email: "a@example.com", password: "long-enough-password" }, authService: service({ async register(body, context) { input.push({ body, context }); return { customer: { id: "customer-1", status: "PENDING_VERIFICATION" } }; } }) });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, "customer-1");
  assert.equal(input[0].context.requestId, "req-auth");
  assert.ok(Buffer.isBuffer(input[0].context.ipHash));
  assert.equal((await invoke("/api/v1/auth/register", { body: { email: "a@example.com", password: "x", role: "ADMIN" } })).status, 400);
  assert.equal((await invoke("/api/v1/auth/register", { body: "{" })).status, 400);
  assert.equal((await invoke("/api/v1/auth/register", { headers: { "content-type": "text/plain" } })).status, 400);
  assert.equal((await invoke("/api/v1/auth/register", { body: `"${"x".repeat(17000)}"` })).status, 400);
});

test("login issues secure scoped cookies without exposing credentials in JSON", async () => {
  const response = await invoke("/api/v1/auth/login", { body: { contact: "a@example.com", password: "password" } });
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body).includes("raw-access"), false);
  assert.equal(JSON.stringify(response.body).includes("raw-refresh"), false);
  const [access, refresh, csrf] = response.headers["set-cookie"];
  assert.match(access, /^pcx_access=raw-access; Path=\/; .*Secure; HttpOnly; SameSite=Strict$/);
  assert.match(refresh, /^pcx_refresh=raw-refresh; Path=\/api\/v1\/auth; .*Secure; HttpOnly; SameSite=Strict$/);
  assert.match(csrf, /^pcx_csrf=.*; Path=\/;/);
  assert.equal(csrf.includes("HttpOnly"), false);
});

test("privileged login returns MFA challenge with only a CSRF cookie", async () => {
  const response = await invoke("/api/v1/auth/login", { body: { contact: "admin@example.com", password: "password" }, authService: service({ async login() { return { status: "mfa_required", challenge: { id: "mfa-1", expiresAt: "2026-08-16T12:05:00.000Z" } }; } }) });
  assert.equal(response.status, 202);
  assert.deepEqual(response.body.data, { status: "mfa_required", challenge: { id: "mfa-1", expiresAt: "2026-08-16T12:05:00.000Z" } });
  // No session tokens yet: only a short-lived CSRF cookie is issued so the
  // follow-up verify-mfa write can satisfy double-submit CSRF.
  const cookies = response.headers["set-cookie"];
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /^pcx_csrf=.*; Path=\/;/);
  assert.equal(cookies[0].includes("HttpOnly"), false);
  assert.equal(cookies.some((value) => value.startsWith("pcx_access=")), false);
  assert.equal(cookies.some((value) => value.startsWith("pcx_refresh=")), false);
});

test("every auth action requires an exact configured origin", async () => {
  assert.equal((await invoke("/api/v1/auth/login", { body: { contact: "a", password: "b" }, headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await invoke("/api/v1/auth/login", { body: { contact: "a", password: "b" }, headers: { origin: `${origin}.evil.example` } })).status, 403);
  assert.equal((await invoke("/api/v1/auth/login", { body: { contact: "a", password: "b" }, allowedOrigins: new Set() })).status, 503);
});

test("refresh requires double-submit CSRF and rotates all cookies", async () => {
  const missing = await invoke("/api/v1/auth/refresh");
  assert.equal(missing.status, 403);
  const mismatch = await invoke("/api/v1/auth/refresh", { headers: { cookie: "pcx_refresh=old; pcx_csrf=one", "x-csrf-token": "two" } });
  assert.equal(mismatch.status, 403);
  let presented;
  const response = await invoke("/api/v1/auth/refresh", { headers: { cookie: "pcx_refresh=old-refresh; pcx_csrf=token", "x-csrf-token": "token" }, authService: service({ async refresh(input) { presented = input; return { status: "refreshed", session }; } }) });
  assert.equal(response.status, 200);
  assert.equal(presented.refreshCredential, "old-refresh");
  assert.equal(response.headers["set-cookie"].length, 3);
});

test("login forwards a trusted-device cookie to the auth service", async () => {
  let received;
  const response = await invoke("/api/v1/auth/login", {
    body: { contact: "admin@example.com", password: "password" },
    headers: { cookie: "pcx_device=raw-device" },
    authService: service({ async login(body, context, options) { received = options; return { status: "mfa_required", challenge: { id: "c1", expiresAt: "2027-01-01T00:15:00.000Z" } }; } })
  });
  assert.equal(response.status, 202);
  assert.deepEqual(received, { trustedDeviceCredential: "raw-device" });
});

test("verify-mfa with rememberDevice issues a device cookie, otherwise it does not", async () => {
  const device = { credential: "device-raw", expiresAt: "2027-02-01T00:00:00.000Z" };
  const response = await invoke("/api/v1/auth/verify-mfa", {
    body: { challengeId: "c1", credential: "123456", rememberDevice: true },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    authService: service({ async verifyMfa(input) { return { status: "authenticated", identity: { userId: "admin-1" }, session, device }; } })
  });
  assert.equal(response.status, 200);
  const cookies = response.headers["set-cookie"];
  assert.equal(cookies.length, 4);
  assert.match(cookies[3], /^pcx_device=device-raw; Path=\/api\/v1\/auth; .*HttpOnly; SameSite=Strict$/);

  const without = await invoke("/api/v1/auth/verify-mfa", {
    body: { challengeId: "c1", credential: "123456", rememberDevice: false },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    authService: service({ async verifyMfa() { return { status: "authenticated", identity: { userId: "admin-1" }, session, device: null }; } })
  });
  assert.equal(without.headers["set-cookie"].length, 3);
});

test("verify-mfa rejects a non-boolean rememberDevice", async () => {
  const response = await invoke("/api/v1/auth/verify-mfa", {
    body: { challengeId: "c1", credential: "123456", rememberDevice: "yes" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" }
  });
  assert.equal(response.status, 400);
});

test("mfa verification validates CSRF and issues session cookies", async () => {
  const missingCsrf = await invoke("/api/v1/auth/verify-mfa", { body: { challengeId: "c1", credential: "123456" } });
  assert.equal(missingCsrf.status, 403);
  let presented;
  const response = await invoke("/api/v1/auth/verify-mfa", {
    body: { challengeId: "c1", credential: "123456" },
    headers: { cookie: "pcx_csrf=token", "x-csrf-token": "token" },
    authService: service({ async verifyMfa(input) { presented = input; return { status: "authenticated", identity: { userId: "admin-1" }, session }; } })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(presented, { challengeId: "c1", credential: "123456", rememberDevice: false });
  assert.deepEqual(response.body.data, { status: "authenticated", identity: { userId: "admin-1" } });
  assert.equal(response.headers["set-cookie"].length, 3);
  assert.equal(JSON.stringify(response.body).includes("123456"), false);
});

test("logout validates CSRF, remains body-free, and expires every cookie", async () => {
  let presented;
  const response = await invoke("/api/v1/auth/logout", { headers: { cookie: "pcx_refresh=unknown; pcx_csrf=token", "x-csrf-token": "token" }, authService: service({ async logout(input) { presented = input; } }) });
  assert.equal(response.status, 204);
  assert.equal(response.body, undefined);
  assert.equal(presented.refreshCredential, "unknown");
  assert.equal(response.headers["set-cookie"].every((value) => value.includes("Max-Age=0")), true);
  assert.equal(response.headers["set-cookie"].some((value) => value.startsWith("pcx_csrf=") && value.includes("Path=/;")), true);
});

test("application failures map to stable request-aware responses", async () => {
  for (const [code, status, publicCode] of [["invalid_credentials", 401, "UNAUTHENTICATED"], ["contact_unavailable", 409, "CONTACT_UNAVAILABLE"], ["rate_limited", 429, "RATE_LIMITED"]]) {
    const response = await invoke("/api/v1/auth/login", { body: { contact: "a", password: "b" }, authService: service({ async login() { throw new AuthenticationError(code); } }) });
    assert.equal(response.status, status);
    assert.equal(response.body.error.code, publicCode);
    assert.equal(response.body.error.requestId, "req-auth");
  }
  const internal = await invoke("/api/v1/auth/login", { body: { contact: "a", password: "b" }, authService: service({ async login() { throw new Error("database password leaked"); } }) });
  assert.equal(internal.status, 500);
  assert.equal(JSON.stringify(internal.body).includes("database password"), false);
  const invalid = await invoke("/api/v1/auth/register", { body: { email: "a@example.com", password: "short" }, authService: service({ async register() { throw new TypeError("password internals"); } }) });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.message.includes("internals"), false);
});

test("auth routes allow POST only and unknown auth resources remain hidden", async () => {
  assert.equal((await invoke("/api/v1/auth/login", { method: "GET" })).status, 405);
  assert.equal((await invoke("/api/v1/auth/login?redirect=evil", { body: { contact: "a", password: "b" } })).status, 400);
  assert.equal((await invoke("/api/v1/auth/unknown")).status, 404);
  assert.equal((await invoke("/api/v1/auth/login/extra")).status, 404);
});
