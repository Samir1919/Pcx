import { randomUUID } from "node:crypto";
import { hasPermission, Permission, Role } from "@pcx/domain";

export class MediaError extends Error {
  constructor(code) { super(code); this.name = "MediaError"; this.code = code; }
}

// Industry-standard cap: a seller may attach at most this many photos to a
// single sell request (enough to show condition from every angle).
export const MAX_IMAGES_PER_RESOURCE = 8;

export function createMediaService({ authService, repository, storage, id = randomUUID }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || typeof repository.create !== "function") throw new TypeError("repository.create is required");
  if (!storage || typeof storage.save !== "function" || typeof storage.read !== "function") throw new TypeError("storage.save and storage.read are required");

  async function customer(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (identity.status !== "ACTIVE" || !Array.isArray(identity.roles) || !identity.roles.includes(Role.CUSTOMER)) throw new MediaError("forbidden");
    return identity;
  }

  async function technician(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INSPECTION_SUBMIT)) throw new MediaError("forbidden");
    return identity;
  }

  async function admin(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.PRICING_MANAGE)) throw new MediaError("forbidden");
    return identity;
  }

  async function shipmentActor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.INVENTORY_MANAGE) && !hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new MediaError("forbidden");
    return identity;
  }

  async function persist(buffer, { visibility, purpose, uploadedBy }) {
    const saved = await storage.save(buffer, { visibility });
    const record = await repository.create({
      id: id(),
      storageKey: saved.storageKey,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      visibility,
      purpose,
      uploadedBy
    });
    return record;
  }

  return Object.freeze({
    // Seller attaches a photo to their own sell request. Ownership is enforced:
    // a customer may only upload to a sell request they own (server-side IDOR guard).
    async addSellRequestMedia(accessCredential, sellRequestId, buffer, purpose = "PHOTO") {
      const identity = await customer(accessCredential);
      const ownerUserId = await repository.findSellRequestOwner(sellRequestId);
      if (!ownerUserId) throw new MediaError("not_found");
      if (ownerUserId !== identity.userId) throw new MediaError("forbidden");
      const existing = await repository.listSellRequestMedia(sellRequestId);
      if (existing.length >= MAX_IMAGES_PER_RESOURCE) throw new MediaError("limit_reached");
      const media = await persist(buffer, { visibility: "PRIVATE", purpose, uploadedBy: identity.userId });
      await repository.linkSellRequest(id(), sellRequestId, media.id, purpose);
      return Object.freeze(media);
    },

    // Technician attaches evidence to an inspection.
    async addInspectionMedia(accessCredential, inspectionId, buffer, purpose = "EVIDENCE") {
      const identity = await technician(accessCredential);
      const media = await persist(buffer, { visibility: "PRIVATE", purpose, uploadedBy: identity.userId });
      await repository.linkInspection(id(), inspectionId, media.id, purpose);
      return Object.freeze(media);
    },

    // Admin attaches the actual public product photo to a listing.
    async addListingMedia(accessCredential, listingId, buffer, purpose = "PHOTO") {
      const identity = await admin(accessCredential);
      const media = await persist(buffer, { visibility: "PUBLIC", purpose, uploadedBy: identity.userId });
      await repository.linkListing(id(), listingId, media.id, purpose);
      return Object.freeze(media);
    },

    async listSellRequestMedia(accessCredential, sellRequestId) {
      const identity = await customer(accessCredential);
      const ownerUserId = await repository.findSellRequestOwner(sellRequestId);
      if (!ownerUserId) throw new MediaError("not_found");
      if (ownerUserId !== identity.userId) throw new MediaError("forbidden");
      return Object.freeze(await repository.listSellRequestMedia(sellRequestId));
    },

    // Admin (non-owner) read of a sell request's attached photos, gated by the
    // pricing permission so the acquisition detail view can render them.
    async listSellRequestMediaForAdmin(accessCredential, sellRequestId) {
      await admin(accessCredential);
      return Object.freeze(await repository.listSellRequestMedia(sellRequestId));
    },

    async listInspectionMedia(accessCredential, inspectionId) {
      await technician(accessCredential);
      return Object.freeze(await repository.listInspectionMedia(inspectionId));
    },

    // Public listing media is openly readable; private evidence requires an
    // internal actor (inspection read / pricing read / admin access).
    async listListingMedia(listingId) {
      return Object.freeze(await repository.listListingMedia(listingId));
    },

    // Admin attaches private packaging evidence to a shipment (box sealed,
    // label, contents). Ownership is not applicable: shipments are internal.
    async addShipmentMedia(accessCredential, shipmentId, buffer, purpose = "PACKAGING") {
      const identity = await shipmentActor(accessCredential);
      const media = await persist(buffer, { visibility: "PRIVATE", purpose, uploadedBy: identity.userId });
      await repository.linkShipment(id(), shipmentId, media.id, purpose);
      return Object.freeze(media);
    },

    async listShipmentMedia(accessCredential, shipmentId) {
      await shipmentActor(accessCredential);
      return Object.freeze(await repository.listShipmentMedia(shipmentId));
    },

    // Admin promotes a seller's private photo onto the listing (pick & promote).
    // The photo flips to PUBLIC and is linked to the listing; the storage key
    // is unchanged so the DB unique(storage_key) constraint is never violated.
    async promoteSellerPhoto(accessCredential, listingId, mediaId) {
      await admin(accessCredential);
      const sellRequestId = await repository.findListingSellRequestId(listingId);
      if (!sellRequestId) throw new MediaError("not_found");
      const sellerMedia = await repository.listSellRequestMedia(sellRequestId);
      const source = sellerMedia.find((m) => m.id === mediaId);
      if (!source) throw new MediaError("forbidden");
      const listingMedia = await repository.listListingMedia(listingId);
      if (listingMedia.some((m) => m.id === source.id)) return Object.freeze(source);
      await storage.promote(source.storageKey);
      const promoted = await repository.updateVisibility(source.id, "PUBLIC");
      await repository.linkListing(id(), listingId, source.id, "PHOTO");
      return Object.freeze(promoted ?? source);
    },

    // Admin picker: seller photos for a listing's source sell request, marked
    // with whether each has already been promoted.
    async listSellerMediaForListing(accessCredential, listingId) {
      await admin(accessCredential);
      const sellRequestId = await repository.findListingSellRequestId(listingId);
      if (!sellRequestId) return Object.freeze([]);
      const sellerMedia = await repository.listSellRequestMedia(sellRequestId);
      const listingMedia = await repository.listListingMedia(listingId);
      const promotedIds = new Set(listingMedia.map((m) => m.id));
      return Object.freeze(sellerMedia.map((m) => Object.freeze({ ...m, promoted: promotedIds.has(m.id) })));
    },

    async read(accessCredential, mediaId, { thumb = false } = {}) {
      const media = await repository.findById(mediaId);
      if (!media) throw new MediaError("not_found");
      if (media.visibility === "PRIVATE") {
        const identity = await authService.authenticateAccess({ accessCredential });
        const allowed = hasPermission(identity, Permission.ADMIN_ACCESS)
          || hasPermission(identity, Permission.INSPECTION_READ)
          || hasPermission(identity, Permission.PRICING_READ);
        if (!allowed) throw new MediaError("forbidden");
      }
      const buffer = thumb
        ? await storage.readThumb(media.storageKey, { visibility: media.visibility })
        : await storage.read(media.storageKey, { visibility: media.visibility });
      return { media, buffer };
    }
  });
}
