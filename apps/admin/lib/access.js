"use client";

// Frontend display of the server-owned authorization policy. The API is the
// enforcement point; these constants only drive which nav/chrome to render and
// which role/status options to show. They must stay in sync with the canonical
// policy in `packages/domain/src/identity`.
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

export const USER_STATUS = Object.freeze({
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED"
});

const ADMIN_ROLES = new Set(["SUPPORT", "TECHNICIAN", "SUPERVISOR", "INVENTORY", "FINANCE", "ADMIN", "SUPER_ADMIN"]);

export function canAccessAdmin(identity) {
  return identity?.status === "ACTIVE"
    && Array.isArray(identity?.roles)
    && identity.roles.some((role) => ADMIN_ROLES.has(role));
}
