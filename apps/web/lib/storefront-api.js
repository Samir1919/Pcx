async function request(path, options = {}) {
  const headers = { accept: "application/json", ...(options.headers ?? {}) };
  if (options.body != null) headers["content-type"] = "application/json";
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) throw new StorefrontApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "The request could not be completed", response.status);
  return payload;
}

export class StorefrontApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "StorefrontApiError";
    this.code = code;
    this.status = status;
  }
}

function cookieValue(name) {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

function csrfHeaders() {
  const token = cookieValue("pcx_csrf");
  return token ? { "x-csrf-token": token } : {};
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function uploadBinary(path, file) {
  const token = cookieValue("pcx_csrf");
  const response = await fetch(path, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/octet-stream",
      ...(token ? { "x-csrf-token": token } : {})
    },
    credentials: "include",
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new StorefrontApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "Upload failed", response.status);
  return payload;
}

// Public storefront surface. Read paths never request serial/cost/private
// evidence; writes carry the double-submit CSRF token from the session cookie
// and rely on server-side authorization/ownership checks for every action.
export const storefrontApi = Object.freeze({
  categories: () => request("/api/v1/categories"),
  brands: () => request("/api/v1/brands"),
  listings: (params) => request(`/api/v1/listings${query(params)}`),
  productModels: (params) => request(`/api/v1/product-models${query(params)}`),
  productModel: (id) => request(`/api/v1/product-models/${encodeURIComponent(id)}`),
  passport: (pcxId) => request(`/api/v1/passport/${encodeURIComponent(pcxId)}`),
  quoteRanges: (params) => request(`/api/v1/quote-ranges${query(params)}`),

  me: () => request("/api/v1/me"),
  login: (contact, password) => request("/api/v1/auth/login", { method: "POST", body: { contact, password } }),
  register: (email, phone, fullName, password) => request("/api/v1/auth/register", { method: "POST", body: { email, phone, fullName, password } }),
  verifyContactCode: (contact, code) => request("/api/v1/auth/verify-contact-code", { method: "POST", body: { contact, code } }),
  logout: () => request("/api/v1/auth/logout", { method: "POST", body: {}, headers: csrfHeaders() }),

  reserve: (inventoryItemId) => request("/api/v1/reservations", { method: "POST", body: { inventoryItemId }, headers: csrfHeaders() }),
  getCart: () => request("/api/v1/cart"),
  addToCart: (inventoryItemId) => request("/api/v1/cart", { method: "POST", body: { inventoryItemId }, headers: csrfHeaders() }),
  removeFromCart: (inventoryItemId) => request(`/api/v1/cart/items/${encodeURIComponent(inventoryItemId)}`, { method: "DELETE", headers: csrfHeaders() }),
  createSellRequest: (body) => request("/api/v1/sell-requests", { method: "POST", body, headers: csrfHeaders() }),
  uploadSellRequestMedia: (sellRequestId, file) => uploadBinary(`/api/v1/sell-requests/${encodeURIComponent(sellRequestId)}/media`, file),
  createWarrantyClaim: (body) => request("/api/v1/claims", { method: "POST", body, headers: csrfHeaders() }),
  acceptOffer: (offerId) => request(`/api/v1/offers/${encodeURIComponent(offerId)}/accept`, { method: "POST", body: {}, headers: csrfHeaders() }),
  rejectOffer: (offerId) => request(`/api/v1/offers/${encodeURIComponent(offerId)}/reject`, { method: "POST", body: {}, headers: csrfHeaders() }),
  merchantListings: () => request("/api/v1/merchant/listings"),
  merchantCreateListing: (body) => request("/api/v1/merchant/listings", { method: "POST", body, headers: csrfHeaders() }),
  merchantUpdateListing: (id, body) => request(`/api/v1/merchant/listings/${encodeURIComponent(id)}`, { method: "PATCH", body, headers: csrfHeaders() }),
  merchantArchiveListing: (id) => request(`/api/v1/merchant/listings/${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() }),
  createOrder: (items) => request("/api/v1/orders", { method: "POST", body: { items }, headers: csrfHeaders() }),
  createPayment: (payment) => request("/api/v1/payments", { method: "POST", body: payment, headers: csrfHeaders() }),
  confirmPayment: (providerTransactionId) => request("/api/v1/payments/confirm", { method: "POST", body: { providerTransactionId }, headers: csrfHeaders() })
});
