import { apiRequest } from "./api-client.js";

// Backwards-compatible re-exports so existing callers keep working; the old
// PaymentApiError and csrfToken now alias the shared api-client versions.
export { ApiError as PaymentApiError, csrfToken } from "./api-client.js";

export const paymentApi = Object.freeze({
  configs: (provider) => apiRequest(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/config`),
  saveConfig: (provider, body) => apiRequest(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/config`, { method: "PUT", body }),
  activate: (provider, body) => apiRequest(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/activate`, { method: "POST", body })
});
