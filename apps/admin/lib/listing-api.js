"use client";

import { apiRequest } from "./api-client.js";

// Backwards-compatible re-export so existing callers can treat this like the
// other admin API modules (shared ApiError + csrfToken).
export { ApiError as ListingApiError, csrfToken } from "./api-client.js";

export const listingApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/listings"),
  createDraft: (body) => apiRequest("/api/v1/admin/listings", { method: "POST", body }),
  publish: (listingId, body) => apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listingId)}/publish`, { method: "POST", body }),
  setPrice: (body) => apiRequest("/api/v1/admin/listings/prices", { method: "POST", body })
});
