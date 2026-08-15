import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { hashOpaqueCredential } from "../../src/modules/identity/credentials.mjs";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresIdentityActionRepository } from "../../src/modules/identity/postgres-identity-action-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("identity action tokens reissue and consume once with security transitions", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresIdentityActionRepository({ pool });
  const userId = "50000000-0000-0000-0000-000000000001";
  const now = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM access_sessions WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM refresh_credentials WHERE family_id IN (SELECT id FROM refresh_families WHERE user_id = $1)", [userId]);
    await pool.query("DELETE FROM refresh_families WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM identity_action_tokens WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.query("INSERT INTO users(id, email, password_hash, status, created_at, updated_at) VALUES ($1, $2, '$argon2id$old', 'PENDING_VERIFICATION', $3, $3)", [userId, "actions@example.com", now]);
    await repository.issue({ id: "51000000-0000-0000-0000-000000000001", userId, purpose: "CONTACT_VERIFICATION", credentialHash: hashOpaqueCredential("verify-old"), expiresAt: "2026-08-17T00:00:00.000Z", createdAt: now });
    await repository.issue({ id: "51000000-0000-0000-0000-000000000002", userId, purpose: "CONTACT_VERIFICATION", credentialHash: hashOpaqueCredential("verify-new"), expiresAt: "2026-08-17T00:01:00.000Z", createdAt: "2026-08-16T00:01:00.000Z" });
    assert.equal((await repository.verifyContact({ credentialHash: hashOpaqueCredential("verify-old"), now: "2026-08-16T00:02:00.000Z" })).status, "invalid");
    assert.equal((await repository.verifyContact({ credentialHash: hashOpaqueCredential("verify-new"), now: "2026-08-16T00:02:00.000Z" })).status, "verified");
    assert.equal((await repository.verifyContact({ credentialHash: hashOpaqueCredential("verify-new"), now: "2026-08-16T00:03:00.000Z" })).status, "invalid");
    const user = await pool.query("SELECT status, contact_verified FROM users WHERE id = $1", [userId]);
    assert.deepEqual(user.rows[0], { status: "ACTIVE", contact_verified: true });

    await repository.issue({ id: "52000000-0000-0000-0000-000000000001", userId, purpose: "PASSWORD_RESET", credentialHash: hashOpaqueCredential("reset"), expiresAt: "2026-08-16T01:00:00.000Z", createdAt: now });
    const familyId = "53000000-0000-0000-0000-000000000001";
    await pool.query("INSERT INTO refresh_families(id, user_id, created_at) VALUES ($1, $2, $3)", [familyId, userId, now]);
    await pool.query("INSERT INTO access_sessions(id, user_id, credential_hash, refresh_family_id, expires_at, created_at) VALUES ('54000000-0000-0000-0000-000000000001', $1, $2, $3, '2026-08-17T00:00:00.000Z', $4)", [userId, hashOpaqueCredential("access"), familyId, now]);
    const reset = await repository.resetPassword({ credentialHash: hashOpaqueCredential("reset"), passwordHash: "$argon2id$new", now: "2026-08-16T00:10:00.000Z" });
    assert.equal(reset.status, "reset");
    assert.equal((await repository.resetPassword({ credentialHash: hashOpaqueCredential("reset"), passwordHash: "$argon2id$again", now: "2026-08-16T00:11:00.000Z" })).status, "invalid");
    const security = await pool.query("SELECT u.password_hash, rf.revoked_at family_revoked, s.revoked_at access_revoked FROM users u JOIN refresh_families rf ON rf.user_id = u.id JOIN access_sessions s ON s.user_id = u.id WHERE u.id = $1", [userId]);
    assert.equal(security.rows[0].password_hash, "$argon2id$new");
    assert.ok(security.rows[0].family_revoked);
    assert.ok(security.rows[0].access_revoked);
  } finally {
    await pool.end();
  }
});
