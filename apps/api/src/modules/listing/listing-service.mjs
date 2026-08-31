import { randomUUID } from "node:crypto";
import { createListing, createListingPrice, createPublicListing, createPublicPassport, publishListing } from "@pcx/domain";
import { hasPermission, Permission } from "@pcx/domain";

export class ListingError extends Error {
  constructor(code) { super(code); this.name = "ListingError"; this.code = code; }
}

const draftFields = new Set(["inventoryItemId", "publicSlug", "warrantyPolicyId"]);
const priceFields = new Set(["listingId", "price", "reason"]);

export function createListingService({ authService, repository, auditLogService, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  for (const method of ["createDraft", "publish", "createPrice", "findById", "listAdmin"]) if (!repository || typeof repository[method] !== "function") throw new TypeError(`repository.${method} is required`);

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE)) throw new ListingError("forbidden");
    return identity;
  }

  async function reader(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_READ)) throw new ListingError("forbidden");
    return identity;
  }

  function exact(input, allowed) {
    for (const key of Object.keys(input ?? {})) if (!allowed.has(key)) throw new ListingError("invalid_input");
    return input ?? {};
  }

  async function auditWrite(action, entityId, actorUserId, afterSnapshot, reason = null) {
    if (!auditLogService) return;
    try {
      await auditLogService.record({ actorUserId, action, entityType: "listing", entityId, afterSnapshot, reason });
    } catch { /* audit must never fail the business operation */ }
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
      const identity = await actor(accessCredential);
      const existing = await repository.findById(listingId);
      if (!existing) throw new ListingError("not_found");
      let published;
      try {
        published = publishListing(existing, { publicSlug: input?.publicSlug, publishedAt: clock() });
      } catch {
        throw new ListingError("invalid_state");
      }
      let result;
      try {
        result = await repository.publish(listingId, published.publicSlug, clock().toISOString());
      } catch (error) {
        // 23505 is one of the listing unique constraints: either another active
        // (PUBLISHED/RESERVED) listing already exists for the same InventoryItem,
        // or the public slug is already taken. Surface a clean conflict instead of
        // a raw database error, which would otherwise become a generic 500.
        if (error?.code === "23505") throw new ListingError("conflict");
        throw error;
      }
      if (result.status !== "published") throw new ListingError("invalid_state");
      await auditWrite("LISTING_PUBLISHED", listingId, identity.userId, { status: "PUBLISHED" });
      return result.record;
    },

    async listAdmin(accessCredential, filters = {}) {
      await reader(accessCredential);
      const result = await repository.listAdmin(filters);
      return Object.freeze({
        data: Object.freeze(result.records.map((row) => Object.freeze({
          id: row.id,
          inventoryItemId: row.inventory_item_id,
          status: row.status,
          publicSlug: row.public_slug,
          publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
          pcxItemId: row.pcx_item_id,
          modelId: row.model_id,
          modelName: row.model_name,
          price: row.price == null ? null : Number(row.price)
        }))),
        meta: Object.freeze({ nextCursor: result.nextCursor })
      });
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
      const saved = await repository.createPrice(record, record.validFrom);
      await auditWrite("PRICE_CHANGED", fields.listingId, identity.userId, { price: fields.price }, fields.reason);
      return Object.freeze(saved);
    },

    // Public passport is backed by a dedicated repository method returning only
    // approved disclosure rows. No private/internal fields are ever projected.
    async publicPassport(pcxItemId) {
      const row = await repository.findPublicPassport(pcxItemId);
      if (!row) return null;
      try {
        return createPublicPassport({
          pcxItemId: row.pcx_item_id,
          inventoryItemId: row.inventory_item_id,
          listingId: row.listing_id,
          modelId: row.model_id,
          name: row.name,
          categoryId: row.category_id,
          brandId: row.brand_id,
          grade: row.condition_grade,
          healthScore: row.current_health_score == null ? null : Number(row.current_health_score),
          price: row.price == null ? null : Number(row.price),
          status: row.status,
          publishedAt: row.published_at,
          specifications: [],
          mediaIds: Array.isArray(row.media_ids) ? row.media_ids : []
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
          inventoryItemId: row.inventory_item_id,
          pcxItemId: row.pcx_item_id,
          modelId: row.model_id,
          name: row.name,
          categoryId: row.category_id,
          brandId: row.brand_id,
          grade: row.condition_grade,
          healthScore: row.current_health_score == null ? null : Number(row.current_health_score),
          price: row.price == null ? null : Number(row.price),
          coverMediaId: row.cover_media_id ?? null,
          publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null
        }))),
        meta: Object.freeze({ nextCursor: result.nextCursor })
      });
    }
  });
}
