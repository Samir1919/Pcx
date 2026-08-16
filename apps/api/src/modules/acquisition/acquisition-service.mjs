import { randomUUID } from "node:crypto";
import { createOffer, createValuation, createAcquisition } from "../../../../../packages/domain/src/acquisition/valuation-offer.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class AcquisitionError extends Error {
  constructor(code) { super(code); this.name = "AcquisitionError"; this.code = code; }
}

const valuationFields = new Set(["sellRequestId", "valuationType", "lowValue", "highValue", "recommendedValue", "inputsSnapshot"]);
const offerFields = new Set(["sellRequestId", "valuationId", "amount", "expiresAt"]);
const acquisitionFields = new Set(["sellRequestId", "acceptedOfferId", "sellerUserId", "sourceType", "idempotencyKey"]);

export function createAcquisitionService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createValuation", "createOffer", "acceptOffer", "findOfferById", "createAcquisition", "findByOffer"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE) && !hasPermission(identity, Permission.ACQUISITION_PAYMENT_MANAGE)) throw new AcquisitionError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new AcquisitionError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async createValuation(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, valuationFields);
      let record;
      try {
        record = createValuation({ id: id(), ...fields, createdBy: identity.userId, createdAt: clock() });
      } catch {
        throw new AcquisitionError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createValuation(record));
      } catch (error) {
        if (error?.code === "23503") throw new AcquisitionError("invalid_reference");
        throw error;
      }
    },

    async createOffer(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, offerFields);
      let record;
      try {
        record = createOffer({ id: id(), ...fields, createdBy: identity.userId, createdAt: clock() });
      } catch {
        throw new AcquisitionError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createOffer(record));
      } catch (error) {
        if (error?.code === "23503") throw new AcquisitionError("invalid_reference");
        throw error;
      }
    },

    async acceptOffer(accessCredential, offerId) {
      const identity = await actor(accessCredential);
      const result = await repository.acceptOffer(offerId, clock().toISOString());
      if (result.status !== "accepted") throw new AcquisitionError("invalid_state");
      return result.record;
    },

    async createAcquisition(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, acquisitionFields);
      const offer = await repository.findOfferById(fields.acceptedOfferId);
      if (!offer) throw new AcquisitionError("not_found");
      if (offer.status !== "ACCEPTED") throw new AcquisitionError("invalid_state");

      const existing = await repository.findByOffer(fields.acceptedOfferId);
      if (existing) return existing; // idempotent replay

      let record;
      try {
        record = createAcquisition({
          id: id(),
          sellRequestId: fields.sellRequestId,
          acceptedOfferId: fields.acceptedOfferId,
          sellerUserId: fields.sellerUserId,
          sourceType: fields.sourceType,
          agreedPrice: offer.amount, // server-owned immutable basis
          acquiredAt: clock(),
          idempotencyKey: fields.idempotencyKey
        });
      } catch {
        throw new AcquisitionError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createAcquisition(record, offer, record.acquiredAt));
      } catch (error) {
        if (error?.code === "23505") throw new AcquisitionError("conflict");
        if (error?.code === "23514") throw new AcquisitionError("invalid_state");
        if (error?.code === "23503") throw new AcquisitionError("invalid_reference");
        throw error;
      }
    }
  });
}
