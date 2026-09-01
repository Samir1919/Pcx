"use client";

import { apiRequest, ApiError, csrfToken } from "./api-client.js";

// Downloads a non-JSON admin export (CSV/NDJSON) with the admin session cookie
// and the surface header that lets the API read `pcx_admin_*` cookies. A plain
// <a href> navigation would drop the admin cookie (no x-pcx-surface header).
async function downloadExport(path, filename) {
  const response = await fetch(path, {
    headers: { accept: "*/*", "x-pcx-surface": "admin" },
    credentials: "include"
  });
  if (!response.ok) throw new ApiError("EXPORT_FAILED", "The export could not be generated", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const opsApi = Object.freeze({
  dashboard: () => apiRequest("/api/v1/admin/reports/operations"),
  biDashboard: () => apiRequest("/api/v1/admin/reports/bi"),
  exportOperationsCsv: () => downloadExport("/api/v1/admin/reports/operations/export?format=csv", "operations-report.csv"),
  auditExportNdjson: () => downloadExport("/api/v1/admin/audit-logs/export?format=ndjson", "audit-logs.ndjson"),
  scheduledExports: () => apiRequest("/api/v1/admin/scheduled-exports"),
  createScheduledExport: (body) => apiRequest("/api/v1/admin/scheduled-exports", { method: "POST", body }),
  removeScheduledExport: (id) => apiRequest(`/api/v1/admin/scheduled-exports/${encodeURIComponent(id)}`, { method: "DELETE" }),
  inventory: () => apiRequest("/api/v1/admin/inventory"),
  inventoryItem: (id) => apiRequest(`/api/v1/admin/inventory/${encodeURIComponent(id)}`),
  itemCosts: (id) => apiRequest(`/api/v1/admin/inventory/${encodeURIComponent(id)}/costs`),
  addItemCost: (id, body) => apiRequest(`/api/v1/admin/inventory/${encodeURIComponent(id)}/costs`, { method: "POST", body }),
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
  overrideInspection: (id, body) => apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/override`, { method: "POST", body }),
  auditLogs: () => apiRequest("/api/v1/admin/audit-logs"),
  uploadInspectionMedia: async (inspectionId, file) => {
    const token = csrfToken();
    if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
    const response = await fetch(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/media`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/octet-stream",
        "x-csrf-token": token
      },
      credentials: "include",
      body: file
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "Upload failed", response.status);
    return payload;
  }
});
