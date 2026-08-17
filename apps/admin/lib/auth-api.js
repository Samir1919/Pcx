"use client";

import { apiRequest } from "./api-client.js";

export const authApi = Object.freeze({
  me: () => apiRequest("/api/v1/me"),
  // Login and register run before any session CSRF cookie exists, so they are
  // Origin-gated by the server rather than CSRF-gated (mirrors auth-http.mjs).
  login: (body) => apiRequest("/api/v1/auth/login", { method: "POST", body, csrf: false }),
  register: (body) => apiRequest("/api/v1/auth/register", { method: "POST", body, csrf: false }),
  verifyMfa: (body) => apiRequest("/api/v1/auth/verify-mfa", { method: "POST", body }),
  logout: () => apiRequest("/api/v1/auth/logout", { method: "POST", body: {} })
});

// Returns the current authenticated identity, or null when signed out.
export async function currentIdentity() {
  try {
    const payload = await authApi.me();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}
