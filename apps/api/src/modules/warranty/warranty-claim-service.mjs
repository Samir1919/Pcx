import { randomUUID } from "node:crypto";
import { createWarranty, createClaim, createClaimResolution } from "../../../../../packages/domain/src/warranty/warranty-claim.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class WarrantyClaimError extends Error {
  constructor(code) { super(code); this.name = "WarrantyClaimError"; this.code = code; }
}

const warrantyFields = new Set(["orderItemId", "inventoryItemId", "policySnapshot", "startsAt", "endsAt"]);
const claimFields = new Set(["warrantyId", "orderItemId", "reasonCode", "symptoms"]);
const resolutionFields = new Set(["claimId", "resolutionType", "notes", "costAmount"]);

export function createWarrantyClaimService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createWarranty", "createClaim", "createResolution", "findWarrantyById", "markClaimResolved"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new WarrantyClaimError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new WarrantyClaimError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async createWarranty(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, warrantyFields);
      let record;
      try {
        record = createWarranty({ id: id(), ...fields });
      } catch {
        throw new WarrantyClaimError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createWarranty(record));
      } catch (error) {
        if (error?.code === "23505") throw new WarrantyClaimError("conflict");
        if (error?.code === "23503") throw new WarrantyClaimError("invalid_reference");
        throw error;
      }
    },

    async createClaim(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, claimFields);
      const warranty = await repository.findWarrantyById(fields.warrantyId);
      if (!warranty || warranty.status !== "ACTIVE") throw new WarrantyClaimError("invalid_state");
      let record;
      try {
        record = createClaim({ id: id(), ...fields, requestedAt: clock() });
      } catch {
        throw new WarrantyClaimError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createClaim(record));
      } catch (error) {
        if (error?.code === "23503") throw new WarrantyClaimError("invalid_reference");
        throw error;
      }
    },

    async resolveClaim(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, resolutionFields);
      let resolution;
      try {
        resolution = createClaimResolution({ id: id(), ...fields, approvedBy: identity.userId, createdAt: clock() });
      } catch {
        throw new WarrantyClaimError("invalid_input");
      }

      const result = await repository.markClaimResolved(fields.claimId, clock().toISOString());
      if (result.status !== "resolved") throw new WarrantyClaimError("invalid_state");

      const saved = await repository.createResolution(resolution);
      return Object.freeze({ claim: result.record, resolution: saved });
    }
  });
}
