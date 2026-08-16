import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresNotificationRepository } from "../../src/modules/notification/postgres-notification-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("notification repository persists outbox and marks sent/failed", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresNotificationRepository({ pool });
  const id = "c0000000-0000-4000-8000-000000000001";
  try {
    await pool.query("DELETE FROM notifications WHERE id::text = $1", [id]);
    const created = await repository.create({ id, userId: null, channel: "EMAIL", notificationType: "ORDER_CONFIRMED", referenceType: "order", referenceId: "o1", payloadSnapshot: { order: 1 }, scheduledAt: null });
    assert.equal(created.status, "PENDING");

    const sent = await repository.markSent(id, "2026-08-16T12:00:00.000Z");
    assert.equal(sent.status, "SENT");
    assert.equal(sent.sentAt, "2026-08-16T12:00:00.000Z");
    assert.equal(await repository.markFailed(id), null);
  } finally {
    await pool.end();
  }
});
