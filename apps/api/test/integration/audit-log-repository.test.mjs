import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresAuditLogRepository } from "../../src/modules/audit/postgres-audit-log-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("audit log repository persists and lists scoped rows", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresAuditLogRepository({ pool });
  try {
    await pool.query("DELETE FROM audit_logs WHERE action = 'e16-test'");
    const created = await repository.create({ actorUserId: null, action: "e16-test", entityType: "order", entityId: "o-e16", beforeSnapshot: { a: 1 }, afterSnapshot: { b: 2 }, reason: "test", ipAddress: "192.0.2.1" });
    assert.equal(created.action, "e16-test");

    const scoped = await repository.list({ entityType: "order", entityId: "o-e16" });
    assert.equal(scoped.length >= 1, true);
    assert.equal(scoped[0].afterSnapshot.b, 2);
  } finally {
    await pool.end();
  }
});
