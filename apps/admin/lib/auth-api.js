"use client";

import { apiRequest } from "./api-client";

export const authApi = Object.freeze({
  me: () => apiRequest("/api/v1/me"),
  login: (body) => apiRequest("/api/v1/auth/login", { method: "POST", body }),
  register: (body) => apiRequest("/api/v1/auth/register", { method: "POST", body }),
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
