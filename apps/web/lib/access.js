"use client";

// Frontend display of the server-owned authorization policy for the
// storefront. The API enforces authorization; these constants only control
// which links/chrome render. They must stay in sync with the canonical policy.
export const ROLE = Object.freeze({
  CUSTOMER: "CUSTOMER",
  MERCHANT: "MERCHANT",
  SUPPORT: "SUPPORT",
  TECHNICIAN: "TECHNICIAN",
  SUPERVISOR: "SUPERVISOR",
  INVENTORY: "INVENTORY",
  FINANCE: "FINANCE",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN"
});

export function isMerchant(identity) {
  return identity?.role === "MERCHANT" || identity?.roles?.includes(ROLE.MERCHANT) || false;
}
