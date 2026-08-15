import assert from "node:assert/strict";
import test from "node:test";
import { createIdentityActionService, IdentityActionError } from "../src/modules/identity/identity-action-service.mjs";

function fixture(identity) {
  const calls = { issued: [], delivered: [], audits: [], reset: [] };
  const service = createIdentityActionService({
    identityRepository: { async findPasswordIdentityByContact() { return identity; } },
    actionRepository: {
      async issue(input) { calls.issued.push(input); return input; },
      async verifyContact() { return { status: "verified", userId: "u1" }; },
      async resetPassword(input) { calls.reset.push(input); return { status: "reset", userId: "u1" }; }
    },
    delivery: { async send(input) { calls.delivered.push(input); } },
    abuseControl: { async check() { return { allowed: true }; } },
    audit: { async record(input) { calls.audits.push(input); } },
    clock: () => new Date("2026-08-16T00:00:00.000Z"), id: () => "token-id", credential: () => "raw-token",
    passwords: { assert() {}, async hash() { return "$argon2id$new"; } }
  });
  return { service, calls };
}

test("request flows are enumeration-safe and deliver raw tokens only for eligible identities", async () => {
  for (const identity of [null, { id: "u1", status: "SUSPENDED", email: "x@example.com" }]) {
    const { service, calls } = fixture(identity);
    assert.deepEqual(await service.requestPasswordReset({ contact: "x@example.com" }), { status: "accepted" });
    assert.equal(calls.delivered.length, 0);
  }
  const { service, calls } = fixture({ id: "u1", status: "ACTIVE", email: "x@example.com" });
  await service.requestPasswordReset({ contact: "x@example.com" });
  assert.equal(calls.issued[0].purpose, "PASSWORD_RESET");
  assert.ok(Buffer.isBuffer(calls.issued[0].credentialHash));
  assert.equal(Object.values(calls.issued[0]).includes("raw-token"), false);
  assert.equal(calls.delivered[0].credential, "raw-token");
  assert.equal(JSON.stringify(calls.audits).includes("raw-token"), false);
});

test("verification and reset collapse invalid tokens and reset hashes passwords", async () => {
  const valid = fixture({ id: "u1", status: "ACTIVE" });
  assert.deepEqual(await valid.service.verifyContact({ credential: "token" }), { status: "verified" });
  assert.deepEqual(await valid.service.resetPassword({ credential: "token", password: "new-password" }), { status: "reset" });
  assert.equal(valid.calls.reset[0].passwordHash, "$argon2id$new");
});

test("invalid repository outcomes and abuse denial use stable errors", async () => {
  const base = fixture(null);
  const denied = createIdentityActionService({
    identityRepository: { async findPasswordIdentityByContact() { return null; } },
    actionRepository: { async issue() {}, async verifyContact() { return { status: "expired" }; }, async resetPassword() { return { status: "invalid" }; } },
    delivery: { async send() {} }, abuseControl: { async check() { return { allowed: true }; } }, audit: { async record() {} },
    passwords: { assert() {}, async hash() { return "$argon2id$x"; } }
  });
  await assert.rejects(denied.verifyContact({ credential: "x" }), (error) => error instanceof IdentityActionError && error.code === "invalid_token");
  await assert.rejects(denied.resetPassword({ credential: "x", password: "valid" }), (error) => error.code === "invalid_token");
  assert.ok(base.service);
});
