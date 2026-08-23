import { apiRequest } from "./api-client.js";

export { ApiError as NotificationProviderApiError } from "./api-client.js";

export const notificationProviderApi = Object.freeze({
  configs: (provider) => apiRequest(`/api/v1/admin/notification-providers/${encodeURIComponent(provider)}/config`),
  saveConfig: (provider, body) => apiRequest(`/api/v1/admin/notification-providers/${encodeURIComponent(provider)}/config`, { method: "PUT", body }),
  activate: (provider, body) => apiRequest(`/api/v1/admin/notification-providers/${encodeURIComponent(provider)}/activate`, { method: "POST", body })
});
