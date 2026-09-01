import assert from "node:assert/strict";
import test from "node:test";
import { createItemCostService, ItemCostError } from "../src/modules/inventory/item-cost-service.mjs";

function fixture(overrides = {}) {
  const calls = { created: [], listed: [], totaled: [] };
  const repository = {
    async create(record) { calls.created.push(record); return record; },
    async listByInventoryItem(id) { calls.listed.push(id); return [{ id: "cost-1", inventoryItemId: id, costType: "TESTING", amount: 100 }]; },
    async totalByInventoryItem(id) { calls.totaled.push(id); return { seed: 4200, allocated: 100, totalCost: 4300 }; },
    ...overrides.repository
  };
  const service = createItemCostService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-09-01T00:00:00.000Z")
  });
  return { service, calls };
}

test("add validates permission, input shape, and records server-owned fields", async () => {
  const { service, calls } = fixture();
  const result = await service.add("access", "inv-1", { costType: "TESTING", amount: 250, reference: "Battery" });
  assert.equal(result.id, "id-1");
  assert.equal(result.recordedBy, "admin-1");
  assert.equal(result.inventoryItemId, "inv-1");
  assert.equal(calls.created.length, 1);

  await assert.rejects(
    service.add("access", "inv-1", { costType: "TESTING", amount: 250, totalCost: 999 }),
    (error) => error instanceof ItemCostError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.add("access", "inv-1", { costType: "UNKNOWN", amount: 250 }),
    (error) => error instanceof ItemCostError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.add("access", "", { costType: "TESTING", amount: 250 }),
    (error) => error instanceof ItemCostError && error.code === "invalid_input"
  );
});

test("add requires INVENTORY_MANAGE permission", async () => {
  const { service } = fixture({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["TECHNICIAN"] }; } }
  });
  await assert.rejects(
    service.add("access", "inv-1", { costType: "TESTING", amount: 250 }),
    (error) => error instanceof ItemCostError && error.code === "forbidden"
  );
});

test("add maps foreign-key violation to invalid_reference", async () => {
  const { service } = fixture({
    repository: { async create() { const e = new Error("fk"); e.code = "23503"; throw e; } }
  });
  await assert.rejects(
    service.add("access", "missing", { costType: "TESTING", amount: 250 }),
    (error) => error instanceof ItemCostError && error.code === "invalid_reference"
  );
});

test("listForItem returns server-derived totals plus entries and enforces read permission", async () => {
  const { service } = fixture();
  const result = await service.listForItem("access", "inv-1");
  assert.equal(result.inventoryItemId, "inv-1");
  assert.equal(result.seedCost, 4200);
  assert.equal(result.allocatedCost, 100);
  assert.equal(result.totalCost, 4300);
  assert.equal(result.entries.length, 1);

  const denied = fixture({
    authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } }
  });
  await assert.rejects(denied.service.listForItem("access", "inv-1"), (error) => error.code === "forbidden");
});
