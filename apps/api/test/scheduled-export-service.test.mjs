import assert from "node:assert/strict";
import test from "node:test";
import { createScheduledExportService } from "../src/modules/reporting/scheduled-export-service.mjs";

function repository(rows = []) {
  return {
    async list() { return rows; },
    async create(record) { return record; },
    async findDue() { return rows; },
    async markRun(id, lastRunAt, lastRowCount) { return { id, lastRunAt, lastRowCount }; }
  };
}

test("scheduled export list and create are permission-gated with allow-listed fields", async () => {
  const service = createScheduledExportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: repository(),
    id: () => "export-1",
    clock: () => new Date("2026-09-01T00:00:00.000Z")
  });

  const created = await service.create("access", { name: "Daily ops", report: "operations", format: "csv", cadence: "daily", enabled: true });
  assert.equal(created.report, "operations");
  assert.equal(created.enabled, true);

  await assert.rejects(service.create("access", { name: "x", report: "bogus", format: "csv", cadence: "daily" }), (e) => e.code === "invalid_input");

  const denied = createScheduledExportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository: repository()
  });
  await assert.rejects(denied.list("access"), (e) => e.code === "forbidden");
});

test("runDue marks each due export with an injected row count", async () => {
  const rows = [
    { id: "e1", name: "Ops", report: "operations", format: "csv", cadence: "daily", enabled: true, lastRunAt: null, lastRowCount: null },
    { id: "e2", name: "Audit", report: "audit", format: "ndjson", cadence: "weekly", enabled: true, lastRunAt: null, lastRowCount: null }
  ];
  const marked = [];
  const service = createScheduledExportService({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: {
      async list() { return []; },
      async create(record) { return record; },
      async findDue() { return rows; },
      async markRun(id, lastRunAt, lastRowCount) { marked.push({ id, lastRowCount }); return { id }; }
    },
    clock: () => new Date("2026-09-01T00:00:00.000Z")
  });

  const ran = await service.runDue({ now: new Date("2026-09-01T00:00:00.000Z"), countRows: async (report) => (report === "operations" ? 42 : 7) });
  assert.equal(ran.length, 2);
  assert.deepEqual(marked.map((m) => m.lastRowCount), [42, 7]);
});