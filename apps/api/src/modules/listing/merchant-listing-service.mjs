import { randomUUID } from "node:crypto";
import { hasPermission, Permission } from "@pcx/domain";

export class MerchantListingError extends Error {
  constructor(code) {
    super(code);
    this.name = "MerchantListingError";
    this.code = code;
  }
}

const draftFields = new Set(["productModelId", "proposedPrice"]);

function positiveOrNull(value) {
  if (value == null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new MerchantListingError("invalid_input");
  return amount;
}

function requiredDependency(value, method, name) {
  if (!value || typeof value[method] !== "function") throw new TypeError(`${name}.${method} is required`);
}

export function createMerchantListingService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  requiredDependency(authService, "authenticateAccess", "authService");
  for (const method of ["createDraft", "findOwnedById", "listForOwner", "updateDraft", "archiveDraft"]) {
    requiredDependency(repository, method, "repository");
  }

  async function merchant(accessCredential, permission) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, permission)) throw new MerchantListingError("forbidden");
    return identity;
  }

  function owned(listing, identity) {
    return listing != null && listing.ownerUserId === identity.userId;
  }

  return Object.freeze({
    async list(accessCredential, filters) {
      const identity = await merchant(accessCredential, Permission.MERCHANT_LISTING_READ_SELF);
      const result = await repository.listForOwner(identity.userId, filters ?? {});
      return Object.freeze({
        data: Object.freeze(result.rows),
        meta: Object.freeze({ nextCursor: result.nextCursor })
      });
    },

    async createDraft(accessCredential, input) {
      const identity = await merchant(accessCredential, Permission.MERCHANT_LISTING_MANAGE_SELF);
      for (const key of Object.keys(input ?? {})) if (!draftFields.has(key)) throw new MerchantListingError("invalid_input");
      if (typeof input.productModelId !== "string" || input.productModelId.length === 0) throw new MerchantListingError("invalid_input");
      const proposedPrice = positiveOrNull(input.proposedPrice);
      const record = await repository.createDraft({
        id: id(),
        ownerUserId: identity.userId,
        productModelId: input.productModelId,
        proposedPrice,
        createdAt: clock().toISOString()
      });
      return Object.freeze(record);
    },

    async updateDraft(accessCredential, listingId, input) {
      const identity = await merchant(accessCredential, Permission.MERCHANT_LISTING_MANAGE_SELF);
      for (const key of Object.keys(input ?? {})) if (!draftFields.has(key)) throw new MerchantListingError("invalid_input");
      const existing = await repository.findOwnedById(listingId);
      if (!existing) throw new MerchantListingError("not_found");
      if (!owned(existing, identity)) throw new MerchantListingError("forbidden");
      if (existing.status !== "DRAFT") throw new MerchantListingError("invalid_state");

      const productModelId = input.productModelId ?? existing.productModelId;
      const proposedPrice = input.proposedPrice === undefined ? existing.proposedPrice : positiveOrNull(input.proposedPrice);
      const updated = await repository.updateDraft({
        id: listingId,
        ownerUserId: identity.userId,
        productModelId,
        proposedPrice,
        now: clock().toISOString()
      });
      if (!updated) throw new MerchantListingError("invalid_state");
      return Object.freeze(updated);
    },

    async archiveDraft(accessCredential, listingId) {
      const identity = await merchant(accessCredential, Permission.MERCHANT_LISTING_MANAGE_SELF);
      const existing = await repository.findOwnedById(listingId);
      if (!existing) throw new MerchantListingError("not_found");
      if (!owned(existing, identity)) throw new MerchantListingError("forbidden");
      const archived = await repository.archiveDraft({ id: listingId, ownerUserId: identity.userId, now: clock().toISOString() });
      if (!archived) throw new MerchantListingError("invalid_state");
      return Object.freeze(archived);
    }
  });
}
