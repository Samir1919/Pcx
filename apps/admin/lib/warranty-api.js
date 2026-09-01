"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as WarrantyApiError, csrfToken } from "./api-client.js";

export const warrantyApi = Object.freeze({
  warranties: () => apiRequest("/api/v1/admin/warranties"),
  claims: () => apiRequest("/api/v1/admin/claims"),
  createWarranty: (body) => apiRequest("/api/v1/admin/warranties", { method: "POST", body }),
  createClaim: (body) => apiRequest("/api/v1/admin/claims", { method: "POST", body }),
  resolveClaim: (body) => apiRequest("/api/v1/admin/claims/resolve", { method: "POST", body }),
  linkInspection: (claimId, inspectionId) => apiRequest(`/api/v1/admin/claims/${encodeURIComponent(claimId)}/inspection`, { method: "POST", body: { inspectionId } }),
  policies: () => apiRequest("/api/v1/admin/warranty-policies"),
  createPolicy: (body) => apiRequest("/api/v1/admin/warranty-policies", { method: "POST", body }),
  archivePolicy: (policyId) => apiRequest(`/api/v1/admin/warranty-policies/${encodeURIComponent(policyId)}/archive`, { method: "POST", body: {} })
});
