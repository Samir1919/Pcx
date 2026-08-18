"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as NotificationApiError, csrfToken } from "./api-client.js";

export const notificationApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/notifications"),
  create: (body) => apiRequest("/api/v1/admin/notifications", { method: "POST", body })
});
