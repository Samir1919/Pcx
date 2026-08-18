// Browser-safe identity surface. Frontend apps import from "@pcx/domain/identity"
// so they get only the pure identity primitives and never pull vendor/backend
// modules from the full package index.
export { Permission, Role, UserStatus } from "./constants.mjs";
export { authorize, authorizeRoleAssignment, hasPermission, permissionsForRole } from "./role-policy.mjs";
