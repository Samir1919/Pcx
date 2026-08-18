import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError, createAuthService } from "../src/modules/identity/auth-service.mjs";
import { hashOpaqueCredential } from "../src/modules/identity/credentials.mjs";

function fixture(overrides = {}) {
  let sequence = 0;
  const calls = { controls: [], audits: [], customers: [], sessions: [], rotations: [], revocations: [] };
  const repository = {
    async createCustomer(input) { calls.customers.push(input); return { id: input.id, status: "PENDING_VERIFICATION", contact_verified: false }; },
    async findPasswordIdentityByContact() { return { id: "user-1", password_hash: "hash", status: "ACTIVE", roles: ["CUSTOMER"] }; },
    async createSession(input) { calls.sessions.push(input); },
    async rotateRefresh(input) { calls.rotations.push(input); return { status: "rotated", userId: "user-1" }; },
    async revokeFamilyByRefreshHash(...input) { calls.revocations.push(input); return true; },
    ...overrides.repository
  };
  const service = createAuthService({
    repository,
    abuseControl: { async check(input) { calls.controls.push(input); return { allowed: true }; }, ...overrides.abuseControl },
    audit: { async record(input) { calls.audits.push(input); }, ...overrides.audit },
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    id: () => `id-${++sequence}`,
    credential: () => `secret-${++sequence}`,
    passwords: { assert() { }, async hash() { return "$argon2id$hash"; }, async verify() { return true; }, ...overrides.passwords },
    mfa: overrides.mfa
  });
  return { service, calls };
}

test("registration owns identity state, hashes password, and audits without secrets", async () => {
  const { service, calls } = fixture();
  const result = await service.register({ email: " User@Example.COM ", password: "not-recorded" }, { requestId: "req-1", ipHash: "ip" });
  assert.equal(result.status, "registered");
  assert.equal(calls.customers[0].email, "user@example.com");
  assert.equal(calls.customers[0].status, "PENDING_VERIFICATION");
  assert.equal(calls.customers[0].roles[0], "CUSTOMER");
  assert.equal(calls.customers[0].passwordHash, "$argon2id$hash");
  assert.equal(JSON.stringify([...calls.controls, ...calls.audits]).includes("not-recorded"), false);
});

test("duplicate registration maps to a stable conflict and is audited", async () => {
  const { service, calls } = fixture({ repository: { async createCustomer() { const error = new Error("duplicate detail"); error.code = "23505"; throw error; } } });
  await assert.rejects(service.register({ phone: "+8801000000000", password: "valid-password" }), (error) => error instanceof AuthenticationError && error.code === "contact_unavailable");
  assert.equal(calls.audits[0].outcome, "conflict");
});

test("login uses one denial for missing, wrong, and inactive identities", async () => {
  for (const repository of [
    { async findPasswordIdentityByContact() { return null; } },
    { async findPasswordIdentityByContact() { return { id: "u", password_hash: "hash", status: "ACTIVE" }; } },
    { async findPasswordIdentityByContact() { return { id: "u", password_hash: "hash", status: "SUSPENDED" }; } }
  ]) {
    const wrongPassword = repository.findPasswordIdentityByContact.toString().includes('status: "ACTIVE"');
    let verificationCount = 0;
    const { service, calls } = fixture({ repository, passwords: { async verify() { verificationCount += 1; return !wrongPassword; } } });
    await assert.rejects(service.login({ contact: "person@example.com", password: "secret" }), (error) => error.code === "invalid_credentials");
    assert.equal(verificationCount, 1);
    assert.equal(calls.sessions.length, 0);
    assert.equal(calls.audits[0].outcome, "denied");
  }
});

test("successful login persists hashes only and returns raw credentials only to caller", async () => {
  const { service, calls } = fixture();
  const result = await service.login({ contact: "person@example.com", password: "password-value" }, { userAgent: "browser" });
  assert.equal(result.status, "authenticated");
  assert.equal(result.identity.userId, "user-1");
  assert.ok(Buffer.isBuffer(calls.sessions[0].accessHash));
  assert.ok(Buffer.isBuffer(calls.sessions[0].refreshHash));
  assert.equal(Object.values(calls.sessions[0]).includes(result.session.accessCredential), false);
  assert.equal(Object.values(calls.sessions[0]).includes(result.session.refreshCredential), false);
  assert.equal(JSON.stringify(calls.audits).includes("secret-"), false);
});

test("refresh rotates hashes and collapses repository failures to invalid refresh", async () => {
  const success = fixture();
  const result = await success.service.refresh({ refreshCredential: "old-refresh" });
  assert.equal(result.status, "refreshed");
  assert.deepEqual(success.calls.rotations[0].presentedHash, hashOpaqueCredential("old-refresh"));
  for (const status of ["invalid", "expired", "reuse_detected"]) {
    const { service, calls } = fixture({ repository: { async rotateRefresh(input) { calls.rotations.push(input); return { status }; } } });
    await assert.rejects(service.refresh({ refreshCredential: "old-refresh" }), (error) => error.code === "invalid_refresh");
    assert.equal(calls.audits[0].outcome, status);
  }
});

test("logout is caller-idempotent and abuse controls fail closed", async () => {
  const allowed = fixture({ repository: { async revokeFamilyByRefreshHash(...input) { allowed.calls.revocations.push(input); return false; } } });
  assert.deepEqual(await allowed.service.logout({ refreshCredential: "unknown" }), { status: "logged_out" });
  assert.equal(allowed.calls.revocations.length, 1);
  const denied = fixture({ abuseControl: { async check() { return { allowed: false }; } } });
  await assert.rejects(denied.service.login({ contact: "x", password: "y" }), (error) => error.code === "rate_limited");
  assert.equal(denied.calls.sessions.length, 0);
  assert.equal(denied.calls.audits[0].outcome, "rate_limited");
});

test("privileged login requires a valid MFA challenge and never creates a password-only session", async () => {
  const repository = { async findPasswordIdentityByContact() { return { id: "admin-1", password_hash: "hash", status: "ACTIVE", roles: ["ADMIN"] }; } };
  const missing = fixture({ repository });
  await assert.rejects(missing.service.login({ contact: "admin@example.com", password: "password" }), (error) => error.code === "mfa_unavailable");
  assert.equal(missing.calls.sessions.length, 0);
  const calls = [];
  const ready = fixture({ repository, mfa: { async beginChallenge(input) { calls.push(input); return { id: "mfa-1", expiresAt: "2026-08-16T12:05:00.000Z", providerSecret: "hidden" }; } } });
  const result = await ready.service.login({ contact: "admin@example.com", password: "password" }, { requestId: "mfa-request" });
  assert.deepEqual(result, { status: "mfa_required", challenge: { id: "mfa-1", expiresAt: "2026-08-16T12:05:00.000Z" } });
  assert.deepEqual(calls, [{ userId: "admin-1", requestId: "mfa-request" }]);
  assert.equal(ready.calls.sessions.length, 0);
});

test("mfa verification completes with a session and fails closed without provider", async () => {
  const missing = fixture();
  await assert.rejects(missing.service.verifyMfa({ challengeId: "c1", credential: "123456" }), (error) => error.code === "invalid_mfa");
  assert.equal(missing.calls.sessions.length, 0);

  const calls = [];
  const ready = fixture({
    mfa: {
      async beginChallenge() { return { id: "c1", expiresAt: "2026-08-16T12:05:00.000Z" }; },
      async verifyChallenge(input) { calls.push(input); return { status: "verified", userId: "admin-1" }; }
    }
  });
  const result = await ready.service.verifyMfa({ challengeId: "c1", credential: "123456" }, { requestId: "mfa-verify-1" });
  assert.equal(result.status, "authenticated");
  assert.equal(result.identity.userId, "admin-1");
  assert.equal(ready.calls.sessions.length, 1);
  assert.deepEqual(calls, [{ challengeId: "c1", credential: "123456", requestId: "mfa-verify-1" }]);
  assert.equal(JSON.stringify(ready.calls.audits).includes("123456"), false);
});

test("access authentication hashes credentials and returns a safe immutable identity", async () => {
  let received;
  const { service } = fixture({ repository: { async findActiveIdentityByAccessHash(hash) { received = hash; return { userId: "u1", email: "buyer@example.com", phone: "01700000000", fullName: "PCX Buyer", status: "ACTIVE", contactVerified: true, roles: ["CUSTOMER"] }; } } });
  const identity = await service.authenticateAccess({ accessCredential: "raw-access" });
  assert.ok(Buffer.isBuffer(received));
  assert.equal(received.length, 32);
  assert.deepEqual(identity, { userId: "u1", email: "buyer@example.com", phone: "01700000000", fullName: "PCX Buyer", status: "ACTIVE", contactVerified: true, roles: ["CUSTOMER"] });
});
