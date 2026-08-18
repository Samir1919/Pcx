"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as UsersApiError, csrfToken } from "./api-client.js";

export const usersApi = Object.freeze({
  list: (params = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") search.set(key, String(value));
    }
    const text = search.toString();
    return apiRequest(`/api/v1/admin/users${text ? `?${text}` : ""}`);
  },
  updateStatus: (userId, status) => apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", body: { status } }),
  replaceRoles: (userId, roles) => apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, { method: "PUT", body: { roles } })
});
