"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as ShipmentApiError, csrfToken } from "./api-client.js";

export const shipmentApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/shipments"),
  create: (body) => apiRequest("/api/v1/admin/shipments", { method: "POST", body }),
  ship: (shipmentId, address) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/ship`, { method: "POST", body: { address } }),
  deliver: (shipmentId) => apiRequest(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/deliver`, { method: "POST", body: {} })
});
