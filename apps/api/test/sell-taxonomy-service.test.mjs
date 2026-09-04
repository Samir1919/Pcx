import assert from "node:assert/strict";
import test from "node:test";
import { SellTaxonomyError, createSellTaxonomyService } from "../src/modules/catalog/sell-taxonomy-service.mjs";

function fixture(roles = ["ADMIN"], commandRepository, catalogService, mediaService) {
  let sequence = 0;
  const calls = [];
  const service = createSellTaxonomyService({
    authService: { async authenticateAccess() { return { userId: "actor-1", status: "ACTIVE", roles }; } },
    catalogService: catalogService ?? { async listCategories() { return { data: [{ id: "11111111-1111-1111-1111-111111111111", name: "Monitors", slug: "monitors" }] }; } },
    mediaService: mediaService === undefined ? { async storeSellEntryIcon(...input) { calls.push(["storeIcon", ...input]); return { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }; } } : mediaService,
    readRepository: { async listEntries(...input) { calls.push(["list", ...input]); return [{ entryKey: "DESKTOP_PC", kind: "BUILD", category: { id: "c1", name: "Desktop PC", slug: "desktop-pc" }, components: [] }]; } },
    commandRepository: commandRepository ?? {
      async createEntry(...input) { calls.push(["createEntry", ...input]); return input[0].entryKey; },
      async deleteEntry(...input) { calls.push(["deleteEntry", ...input]); return true; },
      async updateEntry(...input) { calls.push(["updateEntry", ...input]); return true; },
      async updateComponent(...input) { calls.push(["updateComponent", ...input]); return true; },
      async createComponent(...input) { calls.push(["createComponent", ...input]); return input[0].id; },
      async deleteComponent(...input) { calls.push(["deleteComponent", ...input]); return true; }
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

  await assert.rejects(service.updateEntry("access", "unknown", { hint: "x" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { status: "ACTIVE" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { iconKey: "Raw Emoji!" }), (error) => error.code === "invalid_input");
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

  await assert.rejects(service.updateComponent("access", "DESKTOP_PC", "NotARole", { categoryId: "11111111-1111-1111-1111-111111111111" }), (error) => error.code === "invalid_input");
});

test("not_found surfaces when repository reports no row", async () => {
  const { service } = fixture(["ADMIN"], { createEntry: async () => false, deleteEntry: async () => false, updateEntry: async () => false, updateComponent: async () => false, createComponent: async () => false, deleteComponent: async () => false });
  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { hint: "x" }), (error) => error.code === "not_found");
});

test("createEntry derives the entry key from the category slug", async () => {
  const { service, calls } = fixture();
  const result = await service.createEntry("access", { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "Sell a monitor", sortOrder: 50 }, { requestId: "r3" });
  assert.equal(result.data.entryKey, "MONITORS");
  assert.equal(result.data.kind, "PARTS");
  assert.equal(result.data.isActive, true);
  const create = calls.find(([name]) => name === "createEntry");
  assert.equal(create[1].entryKey, "MONITORS");
  assert.equal(create[3].action, "SELL_ENTRY_CREATED");
});

test("createEntry rejects malformed input", async () => {
  const { service } = fixture();
  const base = { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "Sell a monitor", sortOrder: 50 };
  await assert.rejects(service.createEntry("access", { ...base, categoryId: "not-a-uuid" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createEntry("access", { ...base, kind: "WIDGET" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createEntry("access", { ...base, iconKey: "Raw Emoji!" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createEntry("access", { ...base, hint: "   " }), (error) => error.code === "invalid_input");
});

test("createEntry surfaces invalid_reference when the category is unknown", async () => {
  const { service } = fixture(["ADMIN"], undefined, { async listCategories() { return { data: [] }; } });
  await assert.rejects(service.createEntry("access", { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "x", sortOrder: 0 }), (error) => error.code === "invalid_reference");
});

test("createEntry requires CATALOG_MANAGE", async () => {
  const { service } = fixture(["CUSTOMER"]);
  await assert.rejects(service.createEntry("access", { categoryId: "11111111-1111-1111-1111-111111111111", kind: "PARTS", iconKey: "monitor", hint: "x", sortOrder: 0 }), (error) => error.code === "forbidden");
});

test("deleteEntry removes an entry and audits", async () => {
  const { service, calls } = fixture();
  const result = await service.deleteEntry("access", "DESKTOP_PC", { requestId: "r4" });
  assert.equal(result.entryKey, "DESKTOP_PC");
  const del = calls.find(([name]) => name === "deleteEntry");
  assert.equal(del[1], "DESKTOP_PC");
  assert.equal(del[2].action, "SELL_ENTRY_DELETED");
  await assert.rejects(service.deleteEntry("access", "unknown"), (error) => error.code === "invalid_input");
});

test("deleteEntry surfaces not_found when the row is missing", async () => {
  const { service } = fixture(["ADMIN"], { createEntry: async () => false, deleteEntry: async () => false, updateEntry: async () => false, updateComponent: async () => false, createComponent: async () => false, deleteComponent: async () => false });
  await assert.rejects(service.deleteEntry("access", "DESKTOP_PC"), (error) => error.code === "not_found");
});

test("createComponent validates role and category", async () => {
  const { service, calls } = fixture();
  const result = await service.createComponent("access", "DESKTOP_PC", { role: "panel", categoryId: "11111111-1111-1111-1111-111111111111", required: true, sortOrder: 5 }, { requestId: "r5" });
  assert.equal(result.role, "panel");
  assert.equal(result.required, true);
  const create = calls.find(([name]) => name === "createComponent");
  assert.equal(create[1].role, "panel");
  assert.equal(create[3].action, "SELL_BUILD_COMPONENT_CREATED");
  await assert.rejects(service.createComponent("access", "DESKTOP_PC", { role: "Panel", categoryId: "11111111-1111-1111-1111-111111111111" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createComponent("access", "DESKTOP_PC", { role: "panel", categoryId: "not-a-uuid" }), (error) => error.code === "invalid_input");
});

test("updateComponent supports renaming a role", async () => {
  const { service, calls } = fixture();
  const result = await service.updateComponent("access", "DESKTOP_PC", "gpu", { role: "graphics" }, { requestId: "r-rename" });
  assert.equal(result.role, "graphics");
  const update = calls.find(([name]) => name === "updateComponent");
  assert.equal(update[1], "DESKTOP_PC");
  assert.equal(update[2], "gpu");
  assert.equal(update[3].role, "graphics");
  await assert.rejects(service.updateComponent("access", "DESKTOP_PC", "gpu", { role: "Bad Role" }), (error) => error.code === "invalid_input");
});

test("updateComponent surfaces already_exists on a role-name collision", async () => {
  const { service } = fixture(["ADMIN"], {
    createEntry: async () => false,
    deleteEntry: async () => false,
    updateEntry: async () => false,
    createComponent: async () => false,
    deleteComponent: async () => false,
    updateComponent: async () => { const error = new Error("duplicate"); error.code = "23505"; throw error; }
  });
  await assert.rejects(service.updateComponent("access", "DESKTOP_PC", "gpu", { role: "cpu" }), (error) => error.code === "already_exists");
});

test("deleteComponent validates and removes", async () => {
  const { service, calls } = fixture();
  const result = await service.deleteComponent("access", "DESKTOP_PC", "gpu", { requestId: "r6" });
  assert.equal(result.role, "gpu");
  const del = calls.find(([name]) => name === "deleteComponent");
  assert.equal(del[1], "DESKTOP_PC");
  assert.equal(del[2], "gpu");
  assert.equal(del[3].action, "SELL_BUILD_COMPONENT_DELETED");
  await assert.rejects(service.deleteComponent("access", "DESKTOP_PC", "GPU"), (error) => error.code === "invalid_input");
});

test("updateEntry accepts a nullable iconMediaId and rejects non-uuid values", async () => {
  const { service, calls } = fixture();
  const mediaId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const result = await service.updateEntry("access", "DESKTOP_PC", { iconMediaId: mediaId }, { requestId: "r-icon" });
  assert.equal(result.iconMediaId, mediaId);
  const update = calls.find(([name]) => name === "updateEntry");
  assert.equal(update[2].iconMediaId, mediaId);

  const cleared = await service.updateEntry("access", "DESKTOP_PC", { iconMediaId: null });
  assert.equal(cleared.iconMediaId, null);

  await assert.rejects(service.updateEntry("access", "DESKTOP_PC", { iconMediaId: "not-a-uuid" }), (error) => error.code === "invalid_input");
});

test("setEntryIcon uploads via mediaService and records the media id", async () => {
  const { service, calls } = fixture();
  const buffer = Buffer.from("fake-image");
  const result = await service.setEntryIcon("access", "DESKTOP_PC", buffer, { requestId: "r-icon-set" });
  assert.equal(result.iconMediaId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const store = calls.find(([name]) => name === "storeIcon");
  assert.equal(store[1], "access");
  assert.deepEqual(store[2], buffer);
  const update = calls.find(([name]) => name === "updateEntry");
  assert.equal(update[2].iconMediaId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(update[4].action, "SELL_ENTRY_ICON_SET");
});

test("setEntryIcon rejects non-buffer and propagates malware rejection", async () => {
  const { service } = fixture();
  await assert.rejects(service.setEntryIcon("access", "DESKTOP_PC", "not-buffer"), (error) => error.code === "invalid_input");

  const malwareService = { async storeSellEntryIcon() { const error = new Error("blocked"); error.code = "malware_detected"; throw error; } };
  const malicious = fixture(["ADMIN"], undefined, undefined, malwareService);
  await assert.rejects(malicious.service.setEntryIcon("access", "DESKTOP_PC", Buffer.from("x")), (error) => error.code === "malware_detected");
});

test("setEntryIcon requires a media service", async () => {
  const { service } = fixture(["ADMIN"], undefined, undefined, null);
  await assert.rejects(service.setEntryIcon("access", "DESKTOP_PC", Buffer.from("x")), (error) => error.code === "unavailable");
});

test("clearEntryIcon nulls the icon reference and audits", async () => {
  const { service, calls } = fixture();
  const result = await service.clearEntryIcon("access", "DESKTOP_PC", { requestId: "r-icon-clear" });
  assert.equal(result.iconMediaId, null);
  const update = calls.find(([name]) => name === "updateEntry");
  assert.equal(update[2].iconMediaId, null);
  assert.equal(update[4].action, "SELL_ENTRY_ICON_CLEARED");
  await assert.rejects(service.clearEntryIcon("access", "unknown"), (error) => error.code === "invalid_input");
});
