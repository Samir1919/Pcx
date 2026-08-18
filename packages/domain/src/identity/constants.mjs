export const UserStatus = Object.freeze({
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED"
});

export const Role = Object.freeze({
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

export const Permission = Object.freeze({
  PROFILE_READ_SELF: "profile:read:self",
  PROFILE_UPDATE_SELF: "profile:update:self",
  ADDRESS_MANAGE_SELF: "address:manage:self",
  ADMIN_ACCESS: "admin:access",
  CATALOG_READ: "catalog:read",
  CATALOG_MANAGE: "catalog:manage",
  CUSTOMER_READ_ASSIGNED: "customer:read:assigned",
  IDENTITY_READ: "identity:read",
  IDENTITY_MANAGE: "identity:manage",
  MERCHANT_LISTING_READ_SELF: "merchant-listing:read:self",
  MERCHANT_LISTING_MANAGE_SELF: "merchant-listing:manage:self",
  INSPECTION_READ: "inspection:read",
  INSPECTION_SUBMIT: "inspection:submit",
  INSPECTION_OVERRIDE: "inspection:override",
  INVENTORY_READ: "inventory:read",
  INVENTORY_MANAGE: "inventory:manage",
  PRICING_READ: "pricing:read",
  PRICING_MANAGE: "pricing:manage",
  PAYMENT_READ: "payment:read",
  ACQUISITION_PAYMENT_MANAGE: "acquisition-payment:manage",
  REFUND_MANAGE: "refund:manage",
  ROLE_READ: "role:read",
  ROLE_ASSIGN: "role:assign",
  AUDIT_READ: "audit:read",
  SYSTEM_CONFIGURE: "system:configure"
});

export const canonicalRoles = new Set(Object.values(Role));
export const canonicalPermissions = new Set(Object.values(Permission));
