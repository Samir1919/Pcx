"use client";

import { apiRequest, ApiError, csrfToken } from "./api-client.js";

// Backwards-compatible re-export so existing callers can treat this like the
// other admin API modules (shared ApiError + csrfToken).
export { ApiError as ListingApiError, csrfToken } from "./api-client.js";

async function uploadListingMedia(listingId, file, purpose = "PHOTO") {
  const token = csrfToken();
  if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
  const response = await fetch(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/media`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/octet-stream",
      "x-csrf-token": token
    },
    credentials: "include",
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "Upload failed", response.status);
  return payload;
}

export const listingApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/listings"),
  createDraft: (body) => apiRequest("/api/v1/admin/listings", { method: "POST", body }),
  publish: (listingId, body) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/publish`, { method: "POST", body }),
  pause: (listingId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/pause`, { method: "POST", body: {} }),
  unpublish: (listingId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/unpublish`, { method: "POST", body: {} }),
  archive: (listingId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/archive`, { method: "POST", body: {} }),
  setPrice: (body) => apiRequest("/api/v1/admin/listings/prices", { method: "POST", body }),
  uploadMedia: (listingId, file, purpose) => uploadListingMedia(listingId, file, purpose),
  listMedia: (listingId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/media`),
  listSellerMedia: (listingId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/seller-media`),
  promoteMedia: (listingId, mediaId) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/media/promote`, { method: "POST", body: { mediaId } }),
  mediaUrl: (mediaId) => `/api/v1/media/${encodeURIComponent(mediaId)}`
});
