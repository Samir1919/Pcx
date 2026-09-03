"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as SellTaxonomyApiError, csrfToken } from "./api-client.js";

export const sellTaxonomyApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/sell-entry-config"),
  createEntry: (body) => apiRequest("/api/v1/admin/sell-entry-config", { method: "POST", body }),
  deleteEntry: (entryKey) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}`, { method: "DELETE" }),
  updateEntry: (entryKey, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}`, { method: "PATCH", body }),
  createComponent: (entryKey, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components`, { method: "POST", body }),
  updateComponent: (entryKey, role, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components/${encodeURIComponent(role)}`, { method: "PATCH", body }),
  deleteComponent: (entryKey, role) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components/${encodeURIComponent(role)}`, { method: "DELETE" })
});
