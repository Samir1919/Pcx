function csrfToken(cookie = document.cookie) { const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("pcx_csrf=")); if (!entry) return null; try { return decodeURIComponent(entry.slice("pcx_csrf=".length)); } catch { return null; } }
async function request(path, { method = "GET", body } = {}) { const headers = { accept: "application/json" }; if (body !== undefined) headers["content-type"] = "application/json"; if (method !== "GET") { const token = csrfToken(); if (!token) throw new PaymentApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403); headers["x-csrf-token"] = token; } const response = await fetch(path, { method, headers, credentials: "include", body: body === undefined ? undefined : JSON.stringify(body) }); if (response.status === 204) return null; const payload = await response.json().catch(() => null); if (!response.ok) throw new PaymentApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "The request could not be completed", response.status); return payload; }
export class PaymentApiError extends Error { constructor(code, message, status) { super(message); this.name = "PaymentApiError"; this.code = code; this.status = status; } }
export const paymentApi = Object.freeze({
  configs: (provider) => request(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/config`),
  saveConfig: (provider, body) => request(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/config`, { method: "PUT", body }),
  activate: (provider, body) => request(`/api/v1/admin/payment-providers/${encodeURIComponent(provider)}/activate`, { method: "POST", body })
});
export { csrfToken };
