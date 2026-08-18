import { canonicalPermissions, canonicalRoles, Permission, Role } from "./constants.mjs";

const rolePermissions = new Map([
  [Role.CUSTOMER, new Set([Permission.PROFILE_READ_SELF, Permission.PROFILE_UPDATE_SELF, Permission.ADDRESS_MANAGE_SELF])],
  [Role.MERCHANT, new Set([Permission.PROFILE_READ_SELF, Permission.PROFILE_UPDATE_SELF, Permission.ADDRESS_MANAGE_SELF, Permission.MERCHANT_LISTING_READ_SELF, Permission.MERCHANT_LISTING_MANAGE_SELF])],
  [Role.SUPPORT, new Set([Permission.ADMIN_ACCESS, Permission.CUSTOMER_READ_ASSIGNED, Permission.INVENTORY_READ, Permission.INSPECTION_READ])],
  [Role.TECHNICIAN, new Set([Permission.ADMIN_ACCESS, Permission.INVENTORY_READ, Permission.INSPECTION_READ, Permission.INSPECTION_SUBMIT])],
  [Role.SUPERVISOR, new Set([Permission.ADMIN_ACCESS, Permission.INVENTORY_READ, Permission.INSPECTION_READ, Permission.INSPECTION_SUBMIT, Permission.INSPECTION_OVERRIDE])],
  [Role.INVENTORY, new Set([Permission.ADMIN_ACCESS, Permission.INVENTORY_READ, Permission.INVENTORY_MANAGE, Permission.INSPECTION_READ, Permission.PRICING_READ])],
  [Role.FINANCE, new Set([Permission.ADMIN_ACCESS, Permission.PAYMENT_READ, Permission.ACQUISITION_PAYMENT_MANAGE, Permission.REFUND_MANAGE, Permission.AUDIT_READ])],
  [Role.ADMIN, new Set([Permission.ADMIN_ACCESS, Permission.CUSTOMER_READ_ASSIGNED, Permission.CATALOG_READ, Permission.CATALOG_MANAGE, Permission.IDENTITY_READ, Permission.IDENTITY_MANAGE, Permission.INVENTORY_READ, Permission.INVENTORY_MANAGE, Permission.INSPECTION_READ, Permission.PRICING_READ, Permission.PRICING_MANAGE, Permission.PAYMENT_READ, Permission.ROLE_READ, Permission.ROLE_ASSIGN, Permission.AUDIT_READ, Permission.SYSTEM_CONFIGURE])],
  [Role.SUPER_ADMIN, new Set(Object.values(Permission))]
]);

export function assertCanonicalRoles(roles) {
  if (!Array.isArray(roles) || roles.some((role) => !canonicalRoles.has(role))) {
    throw new TypeError("Identity contains an unknown role");
  }
  return roles;
}

export function hasPermission(identity, permission) {
  if (!canonicalPermissions.has(permission) || !identity || identity.status !== "ACTIVE") return false;
  if (!Array.isArray(identity.roles) || identity.roles.some((role) => !canonicalRoles.has(role))) return false;
  const roles = identity.roles;
  return roles.some((role) => rolePermissions.get(role)?.has(permission));
}

export function authorize(identity, permission, { ownerId, allowOwner = false } = {}) {
  if (permission.endsWith(":self")) {
    const ownsResource = identity?.status === "ACTIVE" && identity.userId === ownerId;
    return ownsResource && hasPermission(identity, permission)
      ? { allowed: true, basis: "owner" }
      : { allowed: false, basis: "default_deny" };
  }
  if (allowOwner && identity?.status === "ACTIVE" && identity.userId === ownerId) return { allowed: true, basis: "owner" };
  if (hasPermission(identity, permission)) return { allowed: true, basis: "permission" };
  return { allowed: false, basis: "default_deny" };
}

export function authorizeRoleAssignment(actor, { targetUserId, nextRoles }) {
  assertCanonicalRoles(nextRoles);
  if (!hasPermission(actor, Permission.ROLE_ASSIGN)) return { allowed: false, reason: "missing_permission" };
  if (actor.userId === targetUserId) return { allowed: false, reason: "self_elevation_blocked" };
  const actorIsSuperAdmin = actor.roles.includes(Role.SUPER_ADMIN);
  if (nextRoles.includes(Role.SUPER_ADMIN) && !actorIsSuperAdmin) return { allowed: false, reason: "super_admin_required" };
  return { allowed: true, reason: "authorized" };
}

export function permissionsForRole(role) {
  if (!canonicalRoles.has(role)) throw new TypeError("Unknown role");
  return Object.freeze([...rolePermissions.get(role)]);
}
