import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { generateOpaqueCredential, hashOpaqueCredential, sessionExpiries } from "../../src/modules/identity/credentials.mjs";
import { createPostgresIdentityRepository } from "../../src/modules/identity/postgres-identity-repository.mjs";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("refresh rotates once and replay revokes the complete family", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresIdentityRepository({ pool });
  const now = "2026-08-16T08:00:00.000Z";
  const userId = randomUUID();
  const initialRefresh = generateOpaqueCredential();
  const initialAccess = generateOpaqueCredential();
  const expiries = sessionExpiries(now);
  try {
    await repository.createCustomer({ userId, id: userId, email: `${userId}@example.com`, phone: null, passwordHash: "$argon2id$test-only-integration-hash", createdAt: now });
    await assert.rejects(
      repository.createCustomer({ id: randomUUID(), email: `${randomUUID()}@example.com`, phone: null, passwordHash: "plaintext", createdAt: now }),
      /Argon2id hash/
    );
    const byEmail = await repository.findPasswordIdentityByContact(`${userId.toUpperCase()}@EXAMPLE.COM`);
    assert.equal(byEmail.id, userId);
    await pool.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [userId]);
    const familyId = randomUUID();
    await repository.createSession({
      userId, familyId, refreshId: randomUUID(), refreshHash: hashOpaqueCredential(initialRefresh), refreshExpiresAt: expiries.refreshExpiresAt,
      accessId: randomUUID(), accessHash: hashOpaqueCredential(initialAccess), accessExpiresAt: expiries.accessExpiresAt, createdAt: now
    });
    assert.equal((await repository.findActiveIdentityByAccessHash(hashOpaqueCredential(initialAccess), "2026-08-16T08:01:00.000Z")).userId, userId);

    const replacementRefresh = generateOpaqueCredential();
    const replacementAccess = generateOpaqueCredential();
    const rotated = await repository.rotateRefresh({
      presentedHash: hashOpaqueCredential(initialRefresh), newRefreshId: randomUUID(), newRefreshHash: hashOpaqueCredential(replacementRefresh), newRefreshExpiresAt: expiries.refreshExpiresAt,
      newAccessId: randomUUID(), newAccessHash: hashOpaqueCredential(replacementAccess), newAccessExpiresAt: expiries.accessExpiresAt, now: "2026-08-16T08:02:00.000Z"
    });
    assert.equal(rotated.status, "rotated");
    assert.equal(await repository.findActiveIdentityByAccessHash(hashOpaqueCredential(initialAccess), "2026-08-16T08:03:00.000Z"), null);
    assert.equal((await repository.findActiveIdentityByAccessHash(hashOpaqueCredential(replacementAccess), "2026-08-16T08:03:00.000Z")).userId, userId);

    const replay = await repository.rotateRefresh({
      presentedHash: hashOpaqueCredential(initialRefresh), newRefreshId: randomUUID(), newRefreshHash: hashOpaqueCredential(generateOpaqueCredential()), newRefreshExpiresAt: expiries.refreshExpiresAt,
      newAccessId: randomUUID(), newAccessHash: hashOpaqueCredential(generateOpaqueCredential()), newAccessExpiresAt: expiries.accessExpiresAt, now: "2026-08-16T08:04:00.000Z"
    });
    assert.equal(replay.status, "reuse_detected");
    assert.equal(await repository.findActiveIdentityByAccessHash(hashOpaqueCredential(replacementAccess), "2026-08-16T08:05:00.000Z"), null);
    const family = await pool.query("SELECT revoked_at, revoke_reason FROM refresh_families WHERE id = $1", [familyId]);
    assert.equal(family.rows[0].revoke_reason, "refresh_reuse_detected");
  } finally {
    await pool.end();
  }
});
