import { randomUUID } from "node:crypto";
import { createListing, createListingPrice, createPublicListing, createPublicPassport, publishListing } from "../../../../../packages/domain/src/listing/listing.mjs";
import { hasPermission, Permission } from "../../../../../packages/domain/src/index.mjs";

export class ListingError extends Error {
  constructor(code) { super(code); this.name = "ListingError"; this.code = code; }
}

const draftFields = new Set(["inventoryItemId", "publicSlug", "warrantyPolicyId"]);
const priceFields = new Set(["listingId", "price", "reason"]);

export function createListingService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createDraft", "publish", "createPrice", "findById"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE)) throw new ListingError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ListingError("invalid_input");
    return input ?? {};
  }

  return Object.freeze({
    async createDraft(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, draftFields);
      let record;
      try {
        record = createListing({ id: id(), inventoryItemId: fields.inventoryItemId, publicSlug: fields.publicSlug, warrantyPolicyId: fields.warrantyPolicyId, createdAt: clock() });
      } catch {
        throw new ListingError("invalid_input");
      }
      try {
        return Object.freeze(await repository.createDraft(record));
      } catch (error) {
        if (error?.code === "23503") throw new ListingError("invalid_reference");
        if (error?.code === "23505") throw new ListingError("conflict");
        throw error;
      }
    },

    async publish(accessCredential, listingId, input) {
      await actor(accessCredential);
      const existing = await repository.findById(listingId);
      if (!existing) throw new ListingError("not_found");
      let published;
      try {
        published = publishListing(existing, { publicSlug: input?.publicSlug, publishedAt: clock() });
      } catch {
        throw new ListingError("invalid_state");
      }
      const result = await repository.publish(listingId, published.publicSlug, clock().toISOString());
      if (result.status !== "published") throw new ListingError("invalid_state");
      return result.record;
    },

    async setPrice(accessCredential, input) {
      const identity = await actor(accessCredential);
      const fields = exact(input, priceFields);
      const listing = await repository.findById(fields.listingId);
      if (!listing) throw new ListingError("not_found");
      let record;
      try {
        record = createListingPrice({ id: id(), listingId: fields.listingId, price: fields.price, reason: fields.reason, setByUser: identity.userId, validFrom: clock() });
      } catch {
        throw new ListingError("invalid_input");
      }
      return Object.freeze(await repository.createPrice(record, record.validFrom));
    },

    // Public passport is backed by a dedicated repository method returning only
    // approved disclosure rows. No private/internal fields are ever projected.
    async publicPassport(pcxItemId) {
      const row = await repository.findPublicPassport(pcxItemId);
      if (!row) return null;
      try {
        return createPublicPassport({
          pcxItemId: row.pcx_item_id,
          modelId: row.model_id,
          name: row.name,
          categoryId: row.category_id,
          brandId: row.brand_id,
          price: row.price == null ? null : Number(row.price),
          status: row.status,
          publishedAt: row.published_at,
          specifications: []
        });
      } catch (error) {
        console.error("[listing] publicPassport construction failed", { pcxItemId, error });
        return null;
      }
    },

    async searchPublic(filters) {
      const result = await repository.searchPublished(filters);
      return Object.freeze({
        data: Object.freeze(result.records.map((row) => createPublicListing({
          id: row.id,
          publicSlug: row.public_slug,
          pcxItemId: row.pcx_item_id,
          modelId: row.model_id,
          name: row.name,
          categoryId: row.category_id,
          brandId: row.brand_id,
          grade: null,
          healthScore: null,
          price: row.price == null ? null : Number(row.price),
          publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null
        }))),
        meta: Object.freeze({ nextCursor: result.nextCursor })
      });
    }
  });
}
