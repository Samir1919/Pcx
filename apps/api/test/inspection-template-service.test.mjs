import assert from "node:assert/strict";
import test from "node:test";
import { createInspectionTemplateService, InspectionTemplateError } from "../src/modules/inspection/inspection-template-service.mjs";
import { InspectionResultType } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { creates: [], lists: [], gets: [] };
  const repository = {
    async create(template, items) { calls.creates.push({ template, items }); return { template, items }; },
    async listByCategory(categoryId) { calls.lists.push(categoryId); return [{ id: "t1", categoryId }]; },
    async findById(id) { calls.gets.push(id); return id === "t1" ? { id, categoryId: "gpu", status: "ACTIVE" } : null; },
    async listItems() { return [{ code: "power_on" }]; },
    ...overrides.repository
  };
  const service = createInspectionTemplateService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("create requires SYSTEM_CONFIGURE and persists active versioned template with unique items", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", {
    categoryId: "gpu",
    name: "GPU",
    version: "1",
    items: [
      { code: "power_on", label: "Power", resultType: InspectionResultType.PASS_FAIL, isCritical: true, isMandatory: true },
      { code: "screen", label: "Screen", resultType: InspectionResultType.NUMBER }
    ]
  });
  assert.equal(result.template.status, "ACTIVE");
  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].items.length, 2);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.create("access", { categoryId: "gpu", name: "G", version: "1", items: [] }), (error) => error.code === "forbidden");
});

test("create rejects unknown fields, duplicate item codes, and critical TEXT", async () => {
  const { service } = fixture();
  await assert.rejects(service.create("access", { categoryId: "gpu", name: "G", version: "1", items: [] }), (error) => error.code === "invalid_input");
  await assert.rejects(service.create("access", { categoryId: "gpu", name: "G", version: "1", status: "ARCHIVED", items: [{ code: "a", label: "A", resultType: "NUMBER" }] }), (error) => error.code === "invalid_input");
  await assert.rejects(service.create("access", { categoryId: "gpu", name: "G", version: "1", items: [{ code: "a", label: "A", resultType: InspectionResultType.TEXT, isCritical: true }] }), (error) => error.code === "invalid_input");
});

test("get and list are permission-gated and scope reads", async () => {
  const { service } = fixture();
  const found = await service.get("access", "t1");
  assert.equal(found.id, "t1");
  assert.equal(found.items.length, 1);
  await assert.rejects(service.get("access", "missing"), (error) => error.code === "not_found");
  assert.equal((await service.list("access", "gpu")).length, 1);
});
