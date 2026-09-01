import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresScheduledExportRepository } from "../../src/modules/reporting/postgres-scheduled-export-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("scheduled export repository persists, finds due rows, and marks runs", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresScheduledExportRepository({ pool });
  const id = "5a000000-0000-4000-8000-000000000001";
  const now = new Date("2026-09-01T00:00:00.000Z");
  try {
    await pool.query("DELETE FROM scheduled_exports WHERE id::text = $1", [id]);
    const created = await repository.create({ id, name: "Ops CSV", report: "operations", format: "csv", cadence: "daily", enabled: true, createdAt: now.toISOString() });
    assert.equal(created.report, "operations");
    assert.equal(created.enabled, true);
    assert.equal(created.lastRunAt, null);

    const due = await repository.findDue(now);
    assert.equal(due.some((r) => r.id === id), true);

    const marked = await repository.markRun(id, now.toISOString(), 42);
    assert.equal(marked.lastRunAt, now.toISOString());
    assert.equal(marked.lastRowCount, 42);

    // Already-run daily export is not due again within the window.
    const again = await repository.findDue(now);
    assert.equal(again.some((r) => r.id === id), false);
  } finally {
    await pool.query("DELETE FROM scheduled_exports WHERE id::text = $1", [id]);
    await pool.end();
  }
});