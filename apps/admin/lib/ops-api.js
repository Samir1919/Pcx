"use client";

import { apiRequest } from "./api-client.js";

export const opsApi = Object.freeze({
  dashboard: () => apiRequest("/api/v1/admin/reports/operations"),
  inventory: () => apiRequest("/api/v1/admin/inventory"),
  inventoryItem: (id) => apiRequest(`/api/v1/admin/inventory/${encodeURIComponent(id)}`),
  intakeInventory: (body) => apiRequest("/api/v1/admin/inventory", { method: "POST", body }),
  templates: (categoryId) => apiRequest(`/api/v1/admin/inspection-templates${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`),
  createTemplate: (body) => apiRequest("/api/v1/admin/inspection-templates", { method: "POST", body }),
  auditLogs: () => apiRequest("/api/v1/admin/audit-logs")
});
