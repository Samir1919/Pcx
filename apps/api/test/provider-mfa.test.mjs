import assert from "node:assert/strict";
import test from "node:test";
import { createProviderMfa } from "../src/modules/identity/provider-mfa.mjs";

function fixture(overrides = {}) {
  const sent = [];
  const identityRepository = {
    async findContactByUserId() { return overrides.contact ?? { email: "admin@example.com", phone: "+8801712345678" }; },
    ...overrides.identityRepository
  };
  const contactDeliveryService = {
    async send(input) { sent.push(input); return { delivered: true, channel: "EMAIL" }; },
    ...overrides.contactDeliveryService
  };
  let i = 0;
  const mfa = createProviderMfa({
    identityRepository,
    contactDeliveryService,
    ttlMs: 60_000,
    clock: () => (overrides.now ?? 1_000_000),
    id: () => `challenge-${++i}`
  });
  return { mfa, sent };
}

test("beginChallenge sends a 6-digit code to the user's email and returns a challenge", async () => {
  const { mfa, sent } = fixture();
  const challenge = await mfa.beginChallenge({ userId: "admin-1" });
  assert.equal(challenge.id, "challenge-1");
  assert.ok(challenge.expiresAt);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].purpose, "MFA");
  assert.equal(sent[0].contact, "admin@example.com");
  assert.match(sent[0].credential, /^\d{6}$/);
});

test("verifyChallenge accepts the delivered code exactly once", async () => {
  const { mfa, sent } = fixture();
  const challenge = await mfa.beginChallenge({ userId: "admin-1" });
  const code = sent[0].credential;

  assert.deepEqual(await mfa.verifyChallenge({ challengeId: challenge.id, credential: code }), { status: "verified", userId: "admin-1" });
  // One-time use: a replay is rejected.
  assert.deepEqual(await mfa.verifyChallenge({ challengeId: challenge.id, credential: code }), { status: "not_verified" });
});

test("verifyChallenge rejects a wrong code", async () => {
  const { mfa, sent } = fixture();
  const challenge = await mfa.beginChallenge({ userId: "admin-1" });
  assert.deepEqual(await mfa.verifyChallenge({ challengeId: challenge.id, credential: "000000" }), { status: "not_verified" });
  assert.notEqual(sent[0].credential, "000000");
});

test("beginChallenge fails closed when the user has no delivery contact", async () => {
  const { mfa } = fixture({ contact: { email: null, phone: null } });
  await assert.rejects(mfa.beginChallenge({ userId: "admin-1" }), /no contact channel/);
});

test("beginChallenge fails closed and discards the challenge when delivery throws", async () => {
  const { mfa } = fixture({
    contactDeliveryService: { async send() { throw new Error("no active provider"); } }
  });
  await assert.rejects(mfa.beginChallenge({ userId: "admin-1" }), /delivery unavailable/);
});
