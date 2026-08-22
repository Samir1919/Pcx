"use client";

import { apiRequest } from "./api-client.js";

export const opsApi = Object.freeze({
  dashboard: () => apiRequest("/api/v1/admin/reports/operations"),
  inventory: () => apiRequest("/api/v1/admin/inventory"),
  inventoryItem: (id) => apiRequest(`/api/v1/admin/inventory/${encodeURIComponent(id)}`),
  intakeInventory: (body) => apiRequest("/api/v1/admin/inventory", { method: "POST", body }),
  templates: (categoryId) => apiRequest(`/api/v1/admin/inspection-templates${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`),
  createTemplate: (body) => apiRequest("/api/v1/admin/inspection-templates", { method: "POST", body }),
  inspections: (inventoryItemId) => apiRequest(`/api/v1/inspections?inventoryItemId=${encodeURIComponent(inventoryItemId)}`),
  startInspection: (body) => apiRequest("/api/v1/inspections", { method: "POST", body }),
  inspectionResults: (id) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/results`),
  putInspectionResult: (id, body) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/results`, { method: "PUT", body }),
  submitInspection: (id) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/submit`, { method: "POST", body: {} }),
  approveInspection: (id) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/approve`, { method: "POST", body: {} }),
  rejectInspection: (id) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/reject`, { method: "POST", body: {} }),
  auditLogs: () => apiRequest("/api/v1/admin/audit-logs")
});
