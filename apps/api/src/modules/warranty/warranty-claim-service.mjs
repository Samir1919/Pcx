import { randomUUID } from "node:crypto";
import { createWarranty, createClaim, createClaimResolution, linkClaimInspection, linkClaimShipment } from "@pcx/domain";
import { hasPermission, Permission, Role } from "@pcx/domain";

export class WarrantyClaimError extends Error {
  constructor(code) { super(code); this.name = "WarrantyClaimError"; this.code = code; }
}

const warrantyFields = new Set(["orderItemId", "inventoryItemId", "policySnapshot", "startsAt", "endsAt"]);
const claimFields = new Set(["warrantyId", "orderItemId", "reasonCode", "symptoms"]);
const resolutionFields = new Set(["claimId", "resolutionType", "notes", "costAmount"]);

export function createWarrantyClaimService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createWarranty", "createClaim", "createResolution", "findWarrantyById", "findWarrantyOwnerUserId", "markClaimResolved", "listWarranties", "listClaims", "findClaimById", "linkInspection", "linkShipment"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);
  if (typeof repository.listWarranties !== "function" || typeof repository.listClaims !== "function") throw new TypeError("repository warranty/claim list methods are required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new WarrantyClaimError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new WarrantyClaimError("invalid_input");
    return input ?? {};
  }

  async function customer(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new WarrantyClaimError("forbidden");
    return identity;
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

    // Customer-owned public path: the customer who owns the warranty can open a
    // claim themselves. The server verifies ownership and ACTIVE warranty state.
    async createClaimForCustomer(accessCredential, input) {
      const identity = await customer(accessCredential);
      const fields = exact(input, claimFields);
      const warranty = await repository.findWarrantyById(fields.warrantyId);
      if (!warranty || warranty.status !== "ACTIVE") throw new WarrantyClaimError("invalid_state");
      const ownerUserId = await repository.findWarrantyOwnerUserId(fields.warrantyId);
      if (!ownerUserId || ownerUserId !== identity.userId) throw new WarrantyClaimError("forbidden");
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

    async listWarranties(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.listWarranties()) });
    },

    async listClaims(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.listClaims()) });
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
    },

    // Link a claim to the inspection of the returned item (REQUESTED → IN_REVIEW).
    // Grounds the resolution in a real inspection rather than a bare reason code.
    async linkInspection(accessCredential, claimId, inspectionId) {
      await actor(accessCredential);
      const claimRecord = await repository.findClaimById(claimId);
      if (!claimRecord) throw new WarrantyClaimError("not_found");
      try {
        linkClaimInspection(claimRecord, inspectionId);
      } catch {
        throw new WarrantyClaimError("invalid_state");
      }
      const updated = await repository.linkInspection(claimId, inspectionId);
      if (!updated) throw new WarrantyClaimError("invalid_state");
      return Object.freeze(updated);
    },

    // Link a claim to the return/pickup shipment (carrier pickup).
    async linkShipment(accessCredential, claimId, shipmentId) {
      await actor(accessCredential);
      const claimRecord = await repository.findClaimById(claimId);
      if (!claimRecord) throw new WarrantyClaimError("not_found");
      try {
        linkClaimShipment(claimRecord, shipmentId);
      } catch {
        throw new WarrantyClaimError("invalid_input");
      }
      const updated = await repository.linkShipment(claimId, shipmentId);
      if (!updated) throw new WarrantyClaimError("invalid_state");
      return Object.freeze(updated);
    }
  });
}
