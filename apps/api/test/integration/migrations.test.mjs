import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("identity migration is repeatable and installs security constraints", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  try {
    const migrations = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
    assert.deepEqual(migrations.rows.map(({ version }) => version), ["0001_identity_auth.sql", "0002_identity_policy_seed.sql", "0003_identity_action_tokens.sql", "0004_catalog.sql", "0005_catalog_admin_policy.sql", "0006_catalog_seed.sql"]);
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const names = new Set(tables.rows.map(({ tablename }) => tablename));
    for (const name of ["users", "roles", "permissions", "user_roles", "role_permissions", "addresses", "access_sessions", "refresh_families", "refresh_credentials", "auth_audit_events", "identity_action_tokens", "categories", "brands", "product_models", "spec_definitions", "model_spec_values"]) assert.equal(names.has(name), true, `${name} is missing`);
    const policyCounts = await pool.query("SELECT (SELECT count(*)::int FROM roles) roles, (SELECT count(*)::int FROM permissions) permissions");
    assert.deepEqual(policyCounts.rows[0], { roles: 8, permissions: 20 });
    const superAdminPermissions = await pool.query("SELECT count(*)::int count FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.code = 'SUPER_ADMIN'");
    assert.equal(superAdminPermissions.rows[0].count, 20);
    const adminRoleAssign = await pool.query("SELECT count(*)::int count FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'ADMIN' AND p.code = 'role:assign'");
    assert.equal(adminRoleAssign.rows[0].count, 0);
    await pool.query("INSERT INTO users(id, email, status) VALUES ('00000000-0000-0000-0000-000000000001', 'Buyer@Example.com', 'ACTIVE') ON CONFLICT DO NOTHING");
    await assert.rejects(
      pool.query("INSERT INTO users(id, email, status) VALUES ('00000000-0000-0000-0000-000000000002', 'buyer@example.COM', 'ACTIVE')"),
      (error) => error.code === "23505"
    );
    await assert.rejects(
      pool.query("INSERT INTO access_sessions(id, user_id, credential_hash, expires_at) VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', decode('aa', 'hex'), now() + interval '1 hour')"),
      (error) => error.code === "23514"
    );
  } finally {
    await pool.end();
  }
});
