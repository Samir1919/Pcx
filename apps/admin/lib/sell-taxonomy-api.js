"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as SellTaxonomyApiError, csrfToken } from "./api-client.js";

export const sellTaxonomyApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/sell-entry-config"),
  updateEntry: (entryKey, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}`, { method: "PATCH", body }),
  updateComponent: (entryKey, role, body) => apiRequest(`/api/v1/admin/sell-entry-config/${encodeURIComponent(entryKey)}/components/${encodeURIComponent(role)}`, { method: "PATCH", body })
});
