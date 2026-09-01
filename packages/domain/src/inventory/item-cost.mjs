// Per-item cost allocation ledger entries.
//
// A physical inventory item accumulates costs beyond the acquisition seed:
// refurbishment, testing, packaging, inbound shipping, and other allocations.
// The `inventory_items.acquisition_cost` column (migration 0036) is the seed
// for the ACQUISITION type; these entries record the remaining allocation.
// Totals are always summed server-side (see sumItemCosts and the repository's
// SQL SUM) — the client only ever supplies one entry's amount, never a total.

export const ItemCostType = Object.freeze({
  ACQUISITION: "ACQUISITION",
  REFURBISHMENT: "REFURBISHMENT",
  TESTING: "TESTING",
  PACKAGING: "PACKAGING",
  SHIPPING_IN: "SHIPPING_IN",
  OTHER: "OTHER"
});

const costTypes = new Set(Object.values(ItemCostType));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalString(value, name) {
  if (value == null || value === "") return null;
  return requiredString(value, name);
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function money(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive amount`);
  return value;
}

export function parseItemCostType(value, name = "costType") {
  if (!costTypes.has(value)) throw new TypeError(`${name} is invalid`);
  return value;
}

export function createItemCost({
  id,
  inventoryItemId,
  costType,
  amount,
  reference = null,
  recordedBy,
  createdAt = new Date()
}) {
  const referenceValue = optionalString(reference, "reference");
  if (referenceValue != null && referenceValue.length > 256) throw new TypeError("reference is too long");
  return Object.freeze({
    id: requiredString(id, "id"),
    inventoryItemId: requiredString(inventoryItemId, "inventoryItemId"),
    costType: parseItemCostType(costType),
    amount: money(amount, "amount"),
    reference: referenceValue,
    recordedBy: requiredString(recordedBy, "recordedBy"),
    createdAt: timestamp(createdAt, "createdAt")
  });
}

// Server-owned total over a list of cost entries. The acquisition seed is added
// by the repository (SQL), so this function sums only the appended entries.
export function sumItemCosts(costs) {
  if (!Array.isArray(costs)) throw new TypeError("costs must be an array");
  return costs.reduce((total, cost) => total + Number(cost.amount ?? 0), 0);
}
