"use client";

import { apiRequest } from "./api-client.js";

export const opsApi = Object.freeze({
  dashboard: () => apiRequest("/api/v1/admin/reports/operations"),
  inventory: () => apiRequest("/api/v1/admin/inventory"),
  intakeInventory: (body) => apiRequest("/api/v1/admin/inventory", { method: "POST", body }),
  templates: (categoryId) => apiRequest(`/api/v1/admin/inspection-templates${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`),
  auditLogs: () => apiRequest("/api/v1/admin/audit-logs")
});
