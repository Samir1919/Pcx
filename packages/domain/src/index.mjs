export const domainInvariants = Object.freeze({
  uniquePhysicalLifecycle: true,
  productModelSeparateFromInventoryItem: true,
  serverAuthoritativeState: true,
  idempotentFinancialOperations: true,
  maskedPublicPassport: true
});

export { Permission, Role, UserStatus } from "./identity/constants.mjs";
export { authorize, authorizeRoleAssignment, hasPermission, permissionsForRole } from "./identity/role-policy.mjs";
export { createSecurityAuditEvent } from "./identity/audit-event.mjs";
export { createCustomerRegistrationCandidate, createOwnAddress } from "./identity/identity-record.mjs";
