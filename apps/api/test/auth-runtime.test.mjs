import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryAuthAbuseControl } from "../src/modules/identity/auth-abuse-control.mjs";
import { createPostgresAuthAudit } from "../src/modules/identity/postgres-auth-audit.mjs";
import { createAuthRuntime, parseAllowedOrigins } from "../src/modules/identity/auth-runtime.mjs";

test("PostgreSQL audit writes one canonical bounded secret-free event", async () => {
  const calls = [];
  const audit = createPostgresAuthAudit({ pool: { async query(...args) { calls.push(args); } }, id: () => "event-id" });
  await audit.record({ action: "login", outcome: "succeeded", subjectId: "user-id", requestId: "request-id", occurredAt: "2026-08-16T00:00:00.000Z", password: "ignored" });
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^INSERT INTO auth_audit_events/);
  assert.deepEqual(calls[0][1], ["event-id", "AUTH_LOGIN_SUCCEEDED", "user-id", "request-id", '{"outcome":"SUCCEEDED"}', "2026-08-16T00:00:00.000Z"]);
  assert.equal(JSON.stringify(calls).includes("ignored"), false);
  await assert.rejects(audit.record({ action: "login;delete", outcome: "failed", occurredAt: new Date() }), /action is invalid/);
});

test("local limiter is deterministic, bounded, resets, and fails closed", async () => {
  let now = 1000;
  const limiter = createInMemoryAuthAbuseControl({ clock: () => now, windowMs: 100, limits: { login: 2 }, maximumKeys: 1 });
  const key = Buffer.alloc(32, 1);
  assert.equal((await limiter.check({ action: "login", ipHash: key })).allowed, true);
  assert.equal((await limiter.check({ action: "login", ipHash: key })).allowed, true);
  assert.equal((await limiter.check({ action: "login", ipHash: key })).allowed, false);
  assert.equal((await limiter.check({ action: "login", ipHash: null })).allowed, false);
  assert.equal((await limiter.check({ action: "unknown", ipHash: key })).allowed, false);
  assert.equal((await limiter.check({ action: "login", ipHash: Buffer.alloc(32, 2) })).allowed, false);
  now = 1100;
  assert.equal((await limiter.check({ action: "login", ipHash: Buffer.alloc(32, 2) })).allowed, true);
});

test("trusted origins are exact normalized HTTP(S) origins", () => {
  assert.deepEqual([...parseAllowedOrigins("https://pcx.example,http://localhost:3000")], ["https://pcx.example", "http://localhost:3000"]);
  for (const invalid of ["", "ftp://pcx.example", "https://user@pcx.example", "https://pcx.example/path", "https://pcx.example?x=1", "https://pcx.example/"]) {
    assert.throws(() => parseAllowedOrigins(invalid), /origin/);
  }
});

test("runtime composition requires PostgreSQL and trusted origins", () => {
  assert.throws(() => createAuthRuntime(), /PostgreSQL pool/);
  const pool = { async query() { }, async connect() { } };
  const delivery = { async send() { } };
  assert.throws(() => createAuthRuntime({ pool, allowedOrigins: "", delivery }), /origin/);
  assert.throws(() => createAuthRuntime({ pool, allowedOrigins: new Set(["https://pcx.example/path"]), delivery }), /origin/);
  assert.throws(() => createAuthRuntime({ pool, allowedOrigins: "https://pcx.example" }), /delivery/);
  const runtime = createAuthRuntime({
    pool,
    allowedOrigins: "https://pcx.example",
    delivery,
    mfa: { async beginChallenge() { return { id: "mfa", expiresAt: "2026-08-16T00:05:00.000Z" }; } },
    abuseControl: { async check() { return { allowed: true }; } },
    audit: { async record() { } }
  });
  assert.equal(typeof runtime.authService.login, "function");
  assert.equal(typeof runtime.identityActionService.resetPassword, "function");
  assert.equal(typeof runtime.addressService.create, "function");
  assert.equal(typeof runtime.catalogService.listProductModels, "function");
  assert.equal(typeof runtime.catalogCommandService.createProductModel, "function");
  assert.equal(typeof runtime.sellRequestService.create, "function");
  assert.equal(typeof runtime.acquisitionService.createValuation, "function");
  assert.equal(typeof runtime.inventoryService.intake, "function");
  assert.equal(typeof runtime.listingService.createDraft, "function");
  assert.equal(typeof runtime.reservationService.create, "function");
  assert.equal(typeof runtime.orderPaymentService.createOrder, "function");
  assert.equal(typeof runtime.shipmentService.create, "function");
  assert.deepEqual([...runtime.allowedOrigins], ["https://pcx.example"]);
});
