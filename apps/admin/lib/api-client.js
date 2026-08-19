"use client";

// Shared admin API client. Wraps fetch with CSRF header, credentials, and
// JSON error normalization. When a privileged (non-auth) request returns 401
// because the 15-minute access token expired, it transparently refreshes the
// session once via `POST /api/v1/auth/refresh` (single-flight) and retries the
// original request. The refresh token is HttpOnly and sent automatically via
// `credentials: "include"`.

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function csrfToken(cookie = typeof document === "undefined" ? "" : document.cookie) {
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("pcx_csrf="));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice("pcx_csrf=".length)); } catch { return null; }
}

// Auth lifecycle endpoints must never trigger a self-refresh loop: a 401 from
// them means the credentials themselves were rejected (or there is no session).
const authPaths = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/verify-mfa"
]);

let refreshInFlight = null;

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const token = csrfToken();
      // `refresh` is a non-GET write and is CSRF-gated by the auth boundary, so
      // it fails closed when the double-submit token is missing.
      if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "x-csrf-token": token },
        credentials: "include",
        body: "{}"
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new ApiError(payload?.error?.code ?? "REFRESH_FAILED", payload?.error?.message ?? "Session refresh failed", response.status);
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function requestOnce(path, { method = "GET", body, csrf = true } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  // The auth boundary does NOT CSRF-gate `login`/`register` (they are protected
  // by Origin + allowed-origins and run before a session cookie exists). Those
  // calls pass `csrf: false`; every other non-GET request fails closed when the
  // `pcx_csrf` cookie is missing rather than sending without the double-submit
  // token.
  if (method !== "GET" && csrf) {
    const token = csrfToken();
    if (!token) throw new ApiError("CSRF_MISSING", "Your secure session is incomplete. Sign in again.", 403);
    headers["x-csrf-token"] = token;
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "The request could not be completed", response.status);
  }
  return payload;
}

export async function apiRequest(path, options) {
  try {
    return await requestOnce(path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || authPaths.has(path)) throw error;
    try {
      await refreshSession();
      return await requestOnce(path, options);
    } catch {
      // Preserve the original 401 so callers keep their existing `error.status`
      // handling (e.g. routing to /login) rather than seeing a refresh error.
      throw error;
    }
  }
}
