import { randomUUID } from "node:crypto";
import { createItemCost, hasPermission, Permission } from "@pcx/domain";

export class ItemCostError extends Error {
  constructor(code) { super(code); this.name = "ItemCostError"; this.code = code; }
}

const costFields = new Set(["costType", "amount", "reference"]);

export function createItemCostService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["create", "listByInventoryItem", "totalByInventoryItem"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function writeActor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE)) throw new ItemCostError("forbidden");
    return identity;
  }

  async function readActor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_READ) && !hasPermission(identity, Permission.INVENTORY_MANAGE)) throw new ItemCostError("forbidden");
    return identity;
  }

  function input(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ItemCostError("invalid_input");
    for (const key of Object.keys(value)) if (!costFields.has(key)) throw new ItemCostError("invalid_input");
    return value;
  }

  return Object.freeze({
    // Admin: record a single per-item cost allocation. `inventoryItemId` comes
    // from the URL path (server-scoped), never from the client body.
    async add(accessCredential, inventoryItemId, fields) {
      const identity = await writeActor(accessCredential);
      if (typeof inventoryItemId !== "string" || inventoryItemId.trim().length === 0) throw new ItemCostError("invalid_input");
      const value = input(fields);
      let record;
      try {
        record = createItemCost({
          id: id(),
          inventoryItemId,
          costType: value.costType,
          amount: value.amount,
          reference: value.reference,
          recordedBy: identity.userId,
          createdAt: clock()
        });
      } catch {
        throw new ItemCostError("invalid_input");
      }
      try {
        return Object.freeze(await repository.create(record));
      } catch (error) {
        if (error?.code === "23503") throw new ItemCostError("invalid_reference");
        if (error?.code === "23514") throw new ItemCostError("invalid_input");
        throw error;
      }
    },

    // Admin: read the cost ledger for an item plus the server-derived totals.
    async listForItem(accessCredential, inventoryItemId) {
      await readActor(accessCredential);
      if (typeof inventoryItemId !== "string" || inventoryItemId.trim().length === 0) throw new ItemCostError("invalid_input");
      const [entries, totals] = await Promise.all([
        repository.listByInventoryItem(inventoryItemId),
        repository.totalByInventoryItem(inventoryItemId)
      ]);
      return Object.freeze({
        inventoryItemId,
        seedCost: totals.seed,
        allocatedCost: totals.allocated,
        totalCost: totals.totalCost,
        entries: Object.freeze(entries)
      });
    }
  });
}
