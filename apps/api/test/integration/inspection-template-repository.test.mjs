import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../src/infrastructure/database/migrate.mjs";
import { createPostgresInspectionTemplateRepository } from "../../src/modules/inspection/postgres-inspection-template-repository.mjs";

const connectionString = process.env.TEST_DATABASE_URL;

test("inspection template repository persists versioned template with items", { skip: !connectionString }, async () => {
  await runMigrations({ connectionString });
  const pool = new pg.Pool({ connectionString });
  const repository = createPostgresInspectionTemplateRepository({ pool });
  const categoryId = "80000000-0000-0000-0000-000000000001"; // seeded Desktop PC category
  const templateId = "9b000000-0000-4000-8000-000000000001";
  const itemA = "9b000000-0000-4000-8000-000000000002";
  const itemB = "9b000000-0000-4000-8000-000000000003";
  const now = "2026-08-16T00:00:00.000Z";
  try {
    await pool.query("DELETE FROM inspection_template_items WHERE template_id::text = $1", [templateId]);
    await pool.query("DELETE FROM inspection_templates WHERE id::text = $1", [templateId]);

    const result = await repository.create(
      { id: templateId, categoryId, name: "Desktop Inspection", version: "1", status: "ACTIVE", createdAt: now },
      [
        { id: itemA, templateId, code: "power_on", label: "Power On", resultType: "PASS_FAIL", unit: null, isMandatory: true, isCritical: true, sortOrder: 1, createdAt: now },
        { id: itemB, templateId, code: "storage_gb", label: "Storage", resultType: "NUMBER", unit: "GB", isMandatory: true, isCritical: false, sortOrder: 2, createdAt: now }
      ]
    );
    assert.equal(result.template.id, templateId);
    assert.equal(result.items.length, 2);

    assert.equal((await repository.findById(templateId)).version, "1");
    assert.equal((await repository.listByCategory(categoryId)).some((t) => t.id === templateId), true);
    const items = await repository.listItems(templateId);
    assert.deepEqual(items.map(({ code }) => code), ["power_on", "storage_gb"]);
  } finally {
    await pool.end();
  }
});
