import { randomUUID } from "node:crypto";
import { createInventoryItem, createSerialIdentifier, assertPrimarySerialIdentifier, generatePcxItemId } from "@pcx/domain";
import { hasPermission, Permission } from "@pcx/domain";

export class InventoryError extends Error {
  constructor(code) { super(code); this.name = "InventoryError"; this.code = code; }
}

// PCX ID is always server-derived and never client-authoritative. Client
// cannot set `pcxItemId` even though the inventory column is nullable.
const intakeFields = new Set(["productModelId", "acquisitionId", "status", "identifiers"]);
const identifierFields = new Set(["identifierType", "value", "isPrimary"]);

export function createInventoryService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createWithIdentifiers", "findById", "list"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE)) throw new InventoryError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new InventoryError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async intake(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, intakeFields);
      if (!Array.isArray(fields.identifiers)) throw new InventoryError("invalid_input");
      const now = clock().toISOString();
      const itemId = id();
      let record;
      try {
        record = createInventoryItem({ id: itemId, productModelId: fields.productModelId, acquisitionId: fields.acquisitionId, pcxItemId: generatePcxItemId(itemId), status: fields.status, receivedAt: now });
      } catch {
        throw new InventoryError("invalid_input");
      }
      let identifiers;
      try {
        identifiers = fields.identifiers.map((value) => {
          const data = exact(value, identifierFields);
          return createSerialIdentifier({ id: id(), inventoryItemId: record.id, identifierType: data.identifierType, value: data.value, isPrimary: data.isPrimary, createdAt: now });
        });
        assertPrimarySerialIdentifier(identifiers);
      } catch {
        throw new InventoryError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createWithIdentifiers(record, identifiers, now));
      } catch (error) {
        if (error?.code === "23505") throw new InventoryError("duplicate_identifier");
        if (error?.code === "23503") throw new InventoryError("invalid_reference");
        throw error;
      }
    },

    async list(accessCredential) {
      await actor(accessCredential);
      return Object.freeze(await repository.list());
    },

    async get(accessCredential, inventoryItemId) {
      await actor(accessCredential);
      const record = await repository.findById(inventoryItemId);
      if (!record) throw new InventoryError("not_found");
      return record;
    }
  });
}
