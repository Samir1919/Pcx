import { randomUUID } from "node:crypto";
import { hasPermission, Permission, Role } from "@pcx/domain";

export class MediaError extends Error {
  constructor(code) { super(code); this.name = "MediaError"; this.code = code; }
}

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

    async listInspectionMedia(accessCredential, inspectionId) {
      await technician(accessCredential);
      return Object.freeze(await repository.listInspectionMedia(inspectionId));
    },

    // Public listing media is openly readable; private evidence requires an
    // internal actor (inspection read / pricing read / admin access).
    async listListingMedia(listingId) {
      return Object.freeze(await repository.listListingMedia(listingId));
    },

    async read(accessCredential, mediaId) {
      const media = await repository.findById(mediaId);
      if (!media) throw new MediaError("not_found");
      if (media.visibility === "PRIVATE") {
        const identity = await authService.authenticateAccess({ accessCredential });
        const allowed = hasPermission(identity, Permission.ADMIN_ACCESS)
          || hasPermission(identity, Permission.INSPECTION_READ)
          || hasPermission(identity, Permission.PRICING_READ);
        if (!allowed) throw new MediaError("forbidden");
      }
      return { media, buffer: await storage.read(media.storageKey, { visibility: media.visibility }) };
    }
  });
}
