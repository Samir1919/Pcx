"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as AcquisitionApiError, csrfToken } from "./api-client.js";

export const acquisitionApi = Object.freeze({
  sellRequests: () => apiRequest("/api/v1/admin/sell-requests"),
  sellRequest: (id) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(id)}`),
  transitionSellRequest: (id, toStatus) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(id)}/transition`, { method: "POST", body: { toStatus } }),
  createValuation: (body) => apiRequest("/api/v1/admin/valuations", { method: "POST", body }),
  createOffer: (body) => apiRequest("/api/v1/admin/offers", { method: "POST", body }),
  acceptOffer: (offerId) => apiRequest(`/api/v1/admin/offers/${encodeURIComponent(offerId)}/accept`, { method: "POST", body: {} }),
  createAcquisition: (body) => apiRequest("/api/v1/admin/acquisitions", { method: "POST", body }),
  markAcquisitionPaid: (acquisitionId) => apiRequest(`/api/v1/admin/acquisitions/${encodeURIComponent(acquisitionId)}/pay`, { method: "POST", body: {} })
});
