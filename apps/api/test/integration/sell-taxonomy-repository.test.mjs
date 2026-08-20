import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresSellTaxonomyRepository } from "../../src/modules/catalog/postgres-sell-taxonomy-repository.mjs";
import { createPostgresSellTaxonomyCommandRepository } from "../../src/modules/catalog/postgres-sell-taxonomy-command-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("sell taxonomy persistence resolves seeded entries, build components, and part children", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresSellTaxonomyRepository({ pool });
  try {
    const entries = await repository.listEntries({ activeOnly: true });
    const byKey = Object.fromEntries(entries.map((e) => [e.entryKey, e]));

    assert.deepEqual(entries.map((e) => e.entryKey).sort(), ["DESKTOP_PC", "LAPTOP", "LAPTOP_PARTS", "PC_PARTS"].sort());

    const desktop = byKey.DESKTOP_PC;
    assert.equal(desktop.kind, "BUILD");
    assert.equal(desktop.category.slug, "desktop-pc");
    assert.deepEqual(desktop.components.map((c) => [c.role, c.required]).sort(), [["cpu", true], ["gpu", false], ["motherboard", true], ["psu", false], ["ram", true], ["storage", true]].sort());

    const laptop = byKey.LAPTOP;
    assert.equal(laptop.components.find((c) => c.role === "ram").category.slug, "laptop-ram");

    const pcParts = byKey.PC_PARTS;
    assert.equal(pcParts.kind, "PARTS");
    assert.deepEqual(pcParts.children.map((c) => c.slug).sort(), ["cpu", "gpu", "motherboard", "psu", "ram", "storage"].sort());

    const laptopParts = byKey.LAPTOP_PARTS;
    assert.deepEqual(laptopParts.children.map((c) => c.slug).sort(), ["battery", "charger", "keyboard", "laptop-ram", "laptop-storage", "screen"].sort());
  } finally {
    await pool.end();
  }
});

test("sell taxonomy command repository updates presentation/config and appends audit", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresSellTaxonomyCommandRepository({ pool });
  const now = new Date().toISOString();
  const actorId = "11111111-1111-1111-1111-111111111111";
  const baseAudit = { actorId, action: "TEST", targetType: "SELL_ENTRY", targetId: "DESKTOP_PC", requestId: "req-test", changes: {}, occurredAt: now };
  try {
    await pool.query("INSERT INTO users(id, email, status) VALUES ($1, 'audit-actor@example.com', 'ACTIVE') ON CONFLICT (id) DO NOTHING", [actorId]);
    const ok = await repository.updateEntry("DESKTOP_PC", { iconKey: "laptop", hint: "Hint changed", sortOrder: 99, isActive: false }, now, { ...baseAudit, id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", changes: { iconKey: "laptop" } });
    assert.equal(ok, true);
    const entryRow = await pool.query("SELECT icon_key, hint, sort_order, is_active FROM sell_entry_config WHERE entry_key='DESKTOP_PC'");
    assert.deepEqual(entryRow.rows[0], { icon_key: "laptop", hint: "Hint changed", sort_order: 99, is_active: false });

    assert.equal(await repository.updateEntry("UNKNOWN_ENTRY", { hint: "x" }, now, { ...baseAudit, changes: {} }), false);

    const ok2 = await repository.updateComponent("DESKTOP_PC", "gpu", { required: false, sortOrder: 61 }, now, { ...baseAudit, id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", targetType: "SELL_BUILD_COMPONENT", targetId: "DESKTOP_PC:gpu", changes: { required: false } });
    assert.equal(ok2, true);
    const compRow = await pool.query("SELECT required, sort_order FROM sell_build_components WHERE entry_key='DESKTOP_PC' AND role='gpu'");
    assert.deepEqual(compRow.rows[0], { required: false, sort_order: 61 });

    const auditRow = await pool.query("SELECT count(*)::int AS count FROM auth_audit_events WHERE action='TEST' AND target_id='DESKTOP_PC'");
    assert.ok(auditRow.rows[0].count >= 1);

    await assert.rejects(repository.updateComponent("DESKTOP_PC", "gpu", { categoryId: "22222222-2222-2222-2222-222222222222" }, now, { ...baseAudit, id: "cccccccc-cccc-cccc-cccc-cccccccccccc", changes: {} }), (error) => error?.code === "23503");
  } finally {
    // Restore seed defaults and remove test audit rows / actor.
    await pool.query("DELETE FROM auth_audit_events WHERE action='TEST'");
    await pool.query("DELETE FROM users WHERE id=$1", [actorId]);
    await pool.query("UPDATE sell_entry_config SET icon_key='desktop', hint='Sell a complete desktop build', sort_order=10, is_active=true WHERE entry_key='DESKTOP_PC'");
    await pool.query("UPDATE sell_build_components SET required=false, sort_order=60 WHERE entry_key='DESKTOP_PC' AND role='gpu'");
    await pool.end();
  }
});
