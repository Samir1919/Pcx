"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as ReturnApiError, csrfToken } from "./api-client.js";

export const returnApi = Object.freeze({
  approve: (returnId) => apiRequest(`/api/v1/returns/${encodeURIComponent(returnId)}/approve`, { method: "POST", body: {} }),
  receive: (returnId) => apiRequest(`/api/v1/returns/${encodeURIComponent(returnId)}/receive`, { method: "POST", body: {} }),
  refund: (returnId, amount) => apiRequest(`/api/v1/returns/${encodeURIComponent(returnId)}/refund`, { method: "POST", body: { amount } })
});
