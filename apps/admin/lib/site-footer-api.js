"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as SiteFooterApiError, csrfToken } from "./api-client.js";

export const siteFooterApi = Object.freeze({
  get: () => apiRequest("/api/v1/admin/footer"),
  save: (body) => apiRequest("/api/v1/admin/footer", { method: "PUT", body })
});
