"use client";

import { apiRequest, ApiError, csrfToken } from "./api-client.js";

export { ApiError as SellTaxonomyApiError, csrfToken } from "./api-client.js";

// Raw binary icon upload (mirrors the listing media upload path): CSRF-gated,
// octet-stream body, credentials included.
async function uploadEntryIcon(entryKey, file) {
  const token = csrfToken();
  if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
  const response = await fetch(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/icon`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/octet-stream", "x-csrf-token": token },
    credentials: "include",
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "Upload failed", response.status);
  return payload;
}

export const sellTaxonomyApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/sell-entry-config"),
  createEntry: (body) => apiRequest("/api/v1/admin/sell-entry-config", { method: "POST", body }),
  deleteEntry: (entryKey) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}`, { method: "DELETE" }),
  updateEntry: (entryKey, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}`, { method: "PATCH", body }),
  createComponent: (entryKey, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components`, { method: "POST", body }),
  updateComponent: (entryKey, role, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components/${encodeURIComponent(role)}`, { method: "PATCH", body }),
  deleteComponent: (entryKey, role) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components/${encodeURIComponent(role)}`, { method: "DELETE" }),
  uploadIcon: (entryKey, file) => uploadEntryIcon(entryKey, file),
  clearIcon: (entryKey) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/icon`, { method: "DELETE" }),
  iconUrl: (mediaId) => `/api/v1/media/${encodeURIComponent(mediaId)}`
});
