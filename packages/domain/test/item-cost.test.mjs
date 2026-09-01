import assert from "node:assert/strict";
import test from "node:test";
import { createItemCost, ItemCostType, parseItemCostType, sumItemCosts } from "../src/index.mjs";

test("createItemCost validates type, positive amount, and optional reference", () => {
  const cost = createItemCost({
    id: "c1",
    inventoryItemId: "inv-1",
    costType: ItemCostType.TESTING,
    amount: 250.5,
    reference: "Battery replacement",
    recordedBy: "admin-1",
    createdAt: "2026-09-01T00:00:00.000Z"
  });
  assert.equal(cost.inventoryItemId, "inv-1");
  assert.equal(cost.costType, ItemCostType.TESTING);
  assert.equal(cost.amount, 250.5);
  assert.equal(cost.reference, "Battery replacement");
  assert.equal(cost.recordedBy, "admin-1");

  assert.equal(createItemCost({ id: "c2", inventoryItemId: "inv-1", costType: "PACKAGING", amount: 10, recordedBy: "a" }).reference, null);
  assert.throws(() => createItemCost({ id: "c3", inventoryItemId: "inv-1", costType: "UNKNOWN", amount: 10, recordedBy: "a" }), /costType/);
  assert.throws(() => createItemCost({ id: "c4", inventoryItemId: "inv-1", costType: "OTHER", amount: 0, recordedBy: "a" }), /positive/);
  assert.throws(() => createItemCost({ id: "c5", inventoryItemId: "inv-1", costType: "OTHER", amount: -1, recordedBy: "a" }), /positive/);
  assert.throws(() => createItemCost({ id: "c6", inventoryItemId: "inv-1", costType: "OTHER", amount: 10, reference: "x".repeat(257), recordedBy: "a" }), /too long/);
});

test("parseItemCostType accepts every declared type", () => {
  for (const type of Object.values(ItemCostType)) {
    assert.equal(parseItemCostType(type), type);
  }
  assert.throws(() => parseItemCostType("acquisition"), /invalid/);
});

test("sumItemCosts totals server-owned entries and treats empty as zero", () => {
  const costs = [
    { amount: 100 },
    { amount: 50.25 },
    { amount: 0 }
  ];
  assert.equal(sumItemCosts(costs), 150.25);
  assert.equal(sumItemCosts([]), 0);
  assert.throws(() => sumItemCosts(null), /array/);
});
