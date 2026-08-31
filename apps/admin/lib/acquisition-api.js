"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as AcquisitionApiError, csrfToken } from "./api-client.js";

export const acquisitionApi = Object.freeze({
  sellRequests: () => apiRequest("/api/v1/admin/sell-requests"),
  sellRequest: (id) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(id)}`),
  listMedia: (sellRequestId) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(sellRequestId)}/media`),
  listOffers: (sellRequestId) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(sellRequestId)}/offers`),
  getAcquisition: (sellRequestId) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(sellRequestId)}/acquisition`),
  mediaUrl: (mediaId) => `/api/v1/media/${encodeURIComponent(mediaId)}`,
  transitionSellRequest: (id, toStatus) => apiRequest(`/api/v1/admin/sell-requests/${encodeURIComponent(id)}/transition`, { method: "POST", body: { toStatus } }),
  createOffer: (body) => apiRequest("/api/v1/admin/offers", { method: "POST", body }),
  acceptOffer: (offerId) => apiRequest(`/api/v1/admin/offers/${encodeURIComponent(offerId)}/accept`, { method: "POST", body: {} }),
  createAcquisition: (body) => apiRequest("/api/v1/admin/acquisitions", { method: "POST", body }),
  markAcquisitionPaid: (acquisitionId) => apiRequest(`/api/v1/admin/acquisitions/${encodeURIComponent(acquisitionId)}/pay`, { method: "POST", body: {} })
});
