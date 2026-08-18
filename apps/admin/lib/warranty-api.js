"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as WarrantyApiError, csrfToken } from "./api-client.js";

export const warrantyApi = Object.freeze({
  createWarranty: (body) => apiRequest("/api/v1/admin/warranties", { method: "POST", body }),
  createClaim: (body) => apiRequest("/api/v1/admin/claims", { method: "POST", body }),
  resolveClaim: (body) => apiRequest("/api/v1/admin/claims/resolve", { method: "POST", body })
});
