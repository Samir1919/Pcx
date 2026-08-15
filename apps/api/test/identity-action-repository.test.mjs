import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresIdentityActionRepository } from "../src/modules/identity/postgres-identity-action-repository.mjs";

const pool = { async query() {}, async connect() { return { async query() { return { rowCount: 0, rows: [] }; }, release() {} }; } };

test("identity action repository rejects raw credentials, invalid purposes, and non-Argon2id resets", async () => {
  const repository = createPostgresIdentityActionRepository({ pool });
  await assert.rejects(repository.issue({ purpose: "ADMIN", credentialHash: Buffer.alloc(32) }), /purpose/);
  await assert.rejects(repository.issue({ purpose: "PASSWORD_RESET", credentialHash: "raw-token" }), /32-byte hash/);
  await assert.rejects(repository.verifyContact({ credentialHash: Buffer.alloc(31) }), /32-byte hash/);
  await assert.rejects(repository.resetPassword({ credentialHash: Buffer.alloc(32), passwordHash: "plaintext" }), /Argon2id/);
  assert.throws(() => createPostgresIdentityActionRepository({}), /PostgreSQL pool/);
});
