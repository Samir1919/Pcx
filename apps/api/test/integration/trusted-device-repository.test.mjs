import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { generateOpaqueCredential, hashOpaqueCredential } from "../../src/modules/identity/credentials.mjs";
import { createPostgresIdentityRepository } from "../../src/modules/identity/postgres-identity-repository.mjs";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("trusted devices store only hashes and resolve only while active and unexpired", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresIdentityRepository({ pool });
  const userId = randomUUID();
  const raw = generateOpaqueCredential();
  try {
    await repository.createCustomer({ id: userId, email: `${userId}@example.com`, phone: null, passwordHash: "$argon2id$test-only-integration-hash", createdAt: "2026-08-16T00:00:00.000Z" });
    await repository.issueTrustedDevice({
      id: randomUUID(),
      userId,
      credentialHash: hashOpaqueCredential(raw),
      expiresAt: "2026-09-15T00:00:00.000Z",
      createdAt: "2026-08-16T00:00:00.000Z"
    });

    assert.equal(await repository.findActiveTrustedDeviceUserId(hashOpaqueCredential(raw), "2026-08-17T00:00:00.000Z"), userId);
    // Expired record must not resolve.
    assert.equal(await repository.findActiveTrustedDeviceUserId(hashOpaqueCredential(raw), "2026-09-16T00:00:00.000Z"), null);

    // Revocation clears active resolution.
    await pool.query("UPDATE trusted_devices SET revoked_at = now() WHERE user_id = $1", [userId]);
    assert.equal(await repository.findActiveTrustedDeviceUserId(hashOpaqueCredential(raw), "2026-08-17T00:00:00.000Z"), null);

    // Raw credential is never stored: only a 32-byte hash column exists.
    const stored = await pool.query("SELECT credential_hash FROM trusted_devices WHERE user_id = $1", [userId]);
    assert.equal(stored.rows[0].credential_hash.toString("hex") === raw, false);
    assert.equal(stored.rows[0].credential_hash.length, 32);
  } finally {
    await pool.end();
  }
});
