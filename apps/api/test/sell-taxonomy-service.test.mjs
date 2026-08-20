import assert from "node:assert/strict";
import test from "node:test";
import { SellTaxonomyError, createSellTaxonomyService } from "../src/modules/catalog/sell-taxonomy-service.mjs";

function fixture(roles = ["ADMIN"], commandRepository) {
  let sequence = 0;
  const calls = [];
  const service = createSellTaxonomyService({
    authService: { async authenticateAccess() { return { userId: "actor-1", status: "ACTIVE", roles }; } },
    readRepository: { async listEntries(...input) { calls.push(["list", ...input]); return [{ entryKey: "DESKTOP_PC", kind: "BUILD", category: { id: "c1", name: "Desktop PC", slug: "desktop-pc" }, components: [] }]; } },
    commandRepository: commandRepository ?? {
      async updateEntry(...input) { calls.push(["updateEntry", ...input]); return true; },
      async updateComponent(...input) { calls.push(["updateComponent", ...input]); return true; }
    },
    id: () => `id-${++sequence}`,
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("public taxonomy never requires auth", async () => {
  const { service, calls } = fixture(["CUSTOMER"]);
  const result = await service.publicTaxonomy();
  assert.equal(result.data[0].entryKey, "DESKTOP_PC");
  assert.deepEqual(calls[0], ["list", { activeOnly: true }]);
});

test("admin write requires CATALOG_MANAGE", async () => {
  for (const role of ["CUSTOMER", "SUPPORT", "TECHNICIAN", "SUPERVISOR", "INVENTORY", "FINANCE"]) {
    const { service } = fixture([role]);
    await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { hint: "Changed" }), (error) => error instanceof SellTaxonomyError && error.code === "forbidden");
  }
});

test("updateEntry validates keys and fields", async () => {
  const { service, calls } = fixture();
  const result = await service.updateEntry("access", "DESKTOP_PC", { hint: "New hint", sortOrder: 5, isActive: true }, { requestId: "r1" });
  assert.equal(result.entryKey, "DESKTOP_PC");
  assert.equal(result.hint, "New hint");
  const update = calls.find(([name]) => name === "updateEntry");
  assert.equal(update[1], "DESKTOP_PC");
  assert.equal(update[2].hint, "New hint");
  assert.equal(update[3], "2026-08-16T00:00:00.000Z");
  assert.equal(update[4].action, "SELL_ENTRY_UPDATED");

  await assert.rejects(service.updateEntry("access", "UNKNOWN", { hint: "x" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { status: "ACTIVE" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { iconKey: "raw-emoji" }), (error) => error.code === "invalid_input");
});

test("updateComponent validates role and maps category", async () => {
  const { service, calls } = fixture();
  const result = await service.updateComponent("access", "DESKTOP_PC", "gpu", { categoryId: "11111111-1111-1111-1111-111111111111", required: true }, { requestId: "r2" });
  assert.equal(result.role, "gpu");
  const update = calls.find(([name]) => name === "updateComponent");
  assert.equal(update[1], "DESKTOP_PC");
  assert.equal(update[2], "gpu");
  assert.equal(update[3].categoryId, "11111111-1111-1111-1111-111111111111");
  assert.equal(update[5].action, "SELL_BUILD_COMPONENT_UPDATED");

  await assert.rejects(service.updateComponent("access", "DESKTOP_PC", "not-a-role", { categoryId: "11111111-1111-1111-1111-111111111111" }), (error) => error.code === "invalid_input");
});

test("not_found surfaces when repository reports no row", async () => {
  const { service } = fixture(["ADMIN"], { updateEntry: async () => false, updateComponent: async () => false });
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { hint: "x" }), (error) => error.code === "not_found");
});
