import { randomUUID } from "node:crypto";
import { createOffer, createAcquisition, markAcquisitionPaid } from "@pcx/domain";
import { hasPermission, Permission, Role } from "@pcx/domain";

export class AcquisitionError extends Error {
  constructor(code) { super(code); this.name = "AcquisitionError"; this.code = code; }
}

const offerFields = new Set(["sellRequestId", "amount", "expiresAt"]);
const acquisitionFields = new Set(["sellRequestId", "acceptedOfferId", "sellerUserId", "sourceType", "idempotencyKey"]);

export function createAcquisitionService({ authService, repository, id = randomUUID, clock = () => new Date(), notificationEmitter = null }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createOffer", "acceptOffer", "rejectOffer", "findOwnerUserIdByOffer", "findOfferById", "createAcquisition", "findByOffer", "markPaid", "findOwnerUserIdBySellRequest", "findSellRequestStatus", "listOffersBySellRequest", "findAcquisitionBySellRequest", "findAcquisitionById"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE) && !hasPermission(identity, Permission.ACQUISITION_PAYMENT_MANAGE)) throw new AcquisitionError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new AcquisitionError("invalid_input");
    return input ?? {};
  }

  async function customerActor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new AcquisitionError("forbidden");
    return identity;
  }

  async function ownerOfOffer(accessCredential, offerId) {
    const identity = await customerActor(accessCredential);
    const ownerUserId = await repository.findOwnerUserIdByOffer(offerId);
    if (!ownerUserId) throw new AcquisitionError("not_found");
    if (ownerUserId !== identity.userId) throw new AcquisitionError("forbidden");
    return identity;
  }

  return Object.freeze({
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
        const created = await repository.createOffer(record);
        if (notificationEmitter && typeof notificationEmitter.emit === "function") {
          try {
            const sellerUserId = await repository.findOwnerUserIdBySellRequest(record.sellRequestId);
            if (sellerUserId) {
              await notificationEmitter.emit({
                notificationType: "OFFER_CREATED",
                userId: sellerUserId,
                channel: "EMAIL",
                referenceType: "offer",
                referenceId: created.id,
                payloadSnapshot: { amount: created.amount }
              });
            }
          } catch { /* best-effort; notification must never fail the offer */ }
        }
        return Object.freeze(created);
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

    // Seller-owned public path: the customer who owns the sell request commits
    // to the final offer. The server verifies ownership and transitions ACTIVE
    // → ACCEPTED (or REJECTED) with expiry enforcement for acceptance.
    async acceptOfferForCustomer(accessCredential, offerId) {
      await ownerOfOffer(accessCredential, offerId);
      const result = await repository.acceptOffer(offerId, clock().toISOString());
      if (result.status !== "accepted") throw new AcquisitionError("invalid_state");
      return result.record;
    },

    async rejectOfferForCustomer(accessCredential, offerId) {
      await ownerOfOffer(accessCredential, offerId);
      const record = await repository.rejectOffer(offerId, clock().toISOString());
      if (!record) throw new AcquisitionError("invalid_state");
      return record;
    },

    // Seller read: list offers attached to a sell request they own. The owner
    // check is by sell request, so another customer can never read these.
    async listOffersForCustomer(accessCredential, sellRequestId) {
      const identity = await customerActor(accessCredential);
      const ownerUserId = await repository.findOwnerUserIdBySellRequest(sellRequestId);
      if (!ownerUserId) throw new AcquisitionError("not_found");
      if (ownerUserId !== identity.userId) throw new AcquisitionError("forbidden");
      return Object.freeze({ data: Object.freeze(await repository.listOffersBySellRequest(sellRequestId)) });
    },

    async createAcquisition(accessCredential, input) {
      await actor(accessCredential);
      const fields = exact(input, acquisitionFields);
      const offer = await repository.findOfferById(fields.acceptedOfferId);
      if (!offer) throw new AcquisitionError("not_found");
      if (offer.status !== "ACCEPTED") throw new AcquisitionError("invalid_state");

      const existing = await repository.findByOffer(fields.acceptedOfferId);
      if (existing) return existing; // idempotent replay

      // Acquisition only opens after physical inspection: the sell request must
      // have advanced ACCEPTED → INSPECTION_REQUIRED → INSPECTING (server-owned),
      // so a "final" offer accepted on a seller's self-description is never paid
      // out before the item has actually been verified.
      const sellRequestStatus = await repository.findSellRequestStatus(fields.sellRequestId);
      if (sellRequestStatus !== "INSPECTING") throw new AcquisitionError("invalid_state");

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
    },

    // Admin read: list offers for a sell request (privileged, not owner-scoped).
    async listOffersForAdmin(accessCredential, sellRequestId) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.listOffersBySellRequest(sellRequestId)) });
    },

    // Admin read: the acquisition (if any) created from a sell request.
    async getAcquisitionForAdmin(accessCredential, sellRequestId) {
      await actor(accessCredential);
      return Object.freeze({ data: await repository.findAcquisitionBySellRequest(sellRequestId) });
    },


    // Internal read for the inventory module intake to allocate acquisition
    // cost onto the received item (server-derived, never client-set). Plain
    // read; the inventory intake actor is already authorized.
    async getAcquisitionAgreedPrice(acquisitionId) {
      const record = await repository.findAcquisitionById(acquisitionId);
      return record ? record.agreedPrice : null;
    },

    async markAcquisitionPaid(accessCredential, acquisitionId) {
      await actor(accessCredential);
      const result = await repository.markPaid(acquisitionId, clock().toISOString());
      if (result.status !== "paid") throw new AcquisitionError("invalid_state");
      return result.record;
    }
  });
}
