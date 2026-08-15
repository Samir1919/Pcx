import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresAuthAudit } from "../../src/modules/identity/postgres-auth-audit.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("auth audit adapter durably appends canonical secret-free events", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const eventId = "40000000-0000-0000-0000-000000000001";
  try {
    await pool.query("DELETE FROM auth_audit_events WHERE id = $1", [eventId]);
    const audit = createPostgresAuthAudit({ pool, id: () => eventId });
    await audit.record({ action: "login", outcome: "denied", subjectId: null, requestId: "integration-request", occurredAt: "2026-08-16T00:00:00.000Z" });
    const result = await pool.query("SELECT actor_id, action, target_type, target_id, request_id, changes, occurred_at FROM auth_audit_events WHERE id = $1", [eventId]);
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].actor_id, null);
    assert.equal(result.rows[0].action, "AUTH_LOGIN_DENIED");
    assert.equal(result.rows[0].target_type, "USER");
    assert.equal(result.rows[0].target_id, "anonymous");
    assert.equal(result.rows[0].request_id, "integration-request");
    assert.deepEqual(result.rows[0].changes, { outcome: "DENIED" });
    assert.equal(new Date(result.rows[0].occurred_at).toISOString(), "2026-08-16T00:00:00.000Z");
  } finally {
    await pool.end();
  }
});
