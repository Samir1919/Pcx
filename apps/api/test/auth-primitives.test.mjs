import assert from "node:assert/strict";
import test from "node:test";
import { generateOpaqueCredential, hashOpaqueCredential, credentialHashMatches, sessionExpiries } from "../src/modules/identity/credentials.mjs";
import { assertPassword, hashPassword, passwordNeedsRehash, passwordPolicy, verifyPassword } from "../src/modules/identity/password.mjs";

test("Argon2id password hashing uses bounded accepted policy and verifies fail closed", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.match(hash, new RegExp(`m=${passwordPolicy.memoryCostKiB}`));
  assert.match(hash, new RegExp(`t=${passwordPolicy.timeCost}`));
  assert.match(hash, new RegExp(`p=${passwordPolicy.parallelism}`));
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "wrong password value"), false);
  assert.equal(await verifyPassword("malformed", password), false);
  assert.equal(passwordNeedsRehash(hash), false);
  assert.throws(() => assertPassword("too-short"), /too short/);
  assert.throws(() => assertPassword("😀".repeat(40)), /too long/);
});

test("opaque credentials use 32 bytes and persist only deterministic hashes", () => {
  const credential = generateOpaqueCredential((length) => Buffer.alloc(length, 7));
  const hash = hashOpaqueCredential(credential);
  assert.equal(Buffer.from(credential, "base64url").length, 32);
  assert.equal(hash.length, 32);
  assert.equal(credentialHashMatches(hash, credential), true);
  assert.equal(credentialHashMatches(hash, `${credential}x`), false);
  assert.equal(credentialHashMatches(Buffer.alloc(1), credential), false);
  assert.throws(() => generateOpaqueCredential(() => Buffer.alloc(31)), /exactly 32 bytes/);
});

test("session expiries match accepted access and refresh lifetimes", () => {
  assert.deepEqual(sessionExpiries("2026-08-16T00:00:00.000Z"), {
    accessExpiresAt: "2026-08-16T00:15:00.000Z",
    refreshExpiresAt: "2026-09-15T00:00:00.000Z"
  });
  assert.throws(() => sessionExpiries("invalid"), /valid timestamp/);
});
