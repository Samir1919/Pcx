"use client";

// Shared admin API client. Wraps fetch with CSRF header, credentials, and
// JSON error normalization. Any 401 from a privileged endpoint is surfaced as
// AuthError so the shell can route the user to /login.

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

export async function apiRequest(path, { method = "GET", body } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") {
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
