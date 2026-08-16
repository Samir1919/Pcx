async function request(path) {
  const response = await fetch(path, { method: "GET", headers: { accept: "application/json" }, credentials: "include" });
  const payload = await response.json().catch(() => null);
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

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// Read-only public storefront surface. Never sends credentials-bearing writes
// and never requests serial/cost/private evidence.
export const storefrontApi = Object.freeze({
  categories: () => request("/api/v1/categories"),
  brands: () => request("/api/v1/brands"),
  listings: (params) => request(`/api/v1/listings${query(params)}`),
  passport: (pcxId) => request(`/api/v1/passport/${encodeURIComponent(pcxId)}`)
});
