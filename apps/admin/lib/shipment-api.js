"use client";

import { apiRequest, ApiError, csrfToken } from "./api-client.js";

export { ApiError as ShipmentApiError, csrfToken } from "./api-client.js";

async function uploadShipmentMedia(shipmentId, file) {
  const token = csrfToken();
  if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
  const response = await fetch(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/media`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/octet-stream", "x-csrf-token": token },
    credentials: "include",
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "Upload failed", response.status);
  return payload;
}

export const shipmentApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/shipments"),
  create: (body) => apiRequest("/api/v1/admin/shipments", { method: "POST", body }),
  ship: (shipmentId, address) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/ship`, { method: "POST", body: { address } }),
  deliver: (shipmentId) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/deliver`, { method: "POST", body: {} }),
  return: (shipmentId) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/return`, { method: "POST", body: {} }),
  listMedia: (shipmentId) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/media`),
  uploadMedia: (shipmentId, file) => uploadShipmentMedia(shipmentId, file),
  mediaUrl: (mediaId) => `/api/v1/media/${encodeURIComponent(mediaId)}`
});
