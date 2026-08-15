import assert from "node:assert/strict";
import test from "node:test";
import {
  authorize,
  authorizeRoleAssignment,
  createSecurityAuditEvent,
  hasPermission,
  Permission,
  Role
} from "../src/index.mjs";

const identity = (userId, roles, status = "ACTIVE") => ({ userId, roles, status });

test("RBAC matrix separates operational duties", () => {
  assert.equal(hasPermission(identity("tech", [Role.TECHNICIAN]), Permission.INSPECTION_SUBMIT), true);
  assert.equal(hasPermission(identity("tech", [Role.TECHNICIAN]), Permission.INSPECTION_OVERRIDE), false);
  assert.equal(hasPermission(identity("support", [Role.SUPPORT]), Permission.REFUND_MANAGE), false);
  assert.equal(hasPermission(identity("finance", [Role.FINANCE]), Permission.INSPECTION_SUBMIT), false);
  assert.equal(hasPermission(identity("inventory", [Role.INVENTORY]), Permission.INSPECTION_OVERRIDE), false);
  assert.equal(hasPermission(identity("supervisor", [Role.SUPERVISOR]), Permission.INSPECTION_OVERRIDE), true);
});

test("authorization defaults to deny and enforces ownership", () => {
  const customer = identity("customer-1", [Role.CUSTOMER]);
  assert.deepEqual(authorize(customer, Permission.ADDRESS_MANAGE_SELF, { ownerId: "customer-1", allowOwner: true }), { allowed: true, basis: "owner" });
  assert.deepEqual(authorize(customer, Permission.ADDRESS_MANAGE_SELF, { ownerId: "customer-2", allowOwner: true }), { allowed: false, basis: "default_deny" });
  assert.deepEqual(authorize(customer, Permission.AUDIT_READ), { allowed: false, basis: "default_deny" });
  assert.equal(hasPermission(identity("disabled", [Role.ADMIN], "SUSPENDED"), Permission.AUDIT_READ), false);
  assert.equal(hasPermission(customer, "unknown:permission"), false);
  assert.equal(hasPermission(identity("unknown-role", ["OWNER"]), Permission.AUDIT_READ), false);
});

test("role assignment blocks privilege escalation", () => {
  const admin = identity("admin-1", [Role.ADMIN]);
  const superAdmin = identity("root-1", [Role.SUPER_ADMIN]);
  assert.deepEqual(authorizeRoleAssignment(admin, { targetUserId: "user-1", nextRoles: [Role.FINANCE] }), { allowed: false, reason: "missing_permission" });
  assert.deepEqual(authorizeRoleAssignment(superAdmin, { targetUserId: "root-1", nextRoles: [Role.SUPER_ADMIN] }), { allowed: false, reason: "self_elevation_blocked" });
  assert.deepEqual(authorizeRoleAssignment(superAdmin, { targetUserId: "user-1", nextRoles: [Role.ADMIN] }), { allowed: true, reason: "authorized" });
  assert.throws(() => authorizeRoleAssignment(superAdmin, { targetUserId: "user-1", nextRoles: ["OWNER"] }), /unknown role/);
});

test("audit events exclude common credential fields", () => {
  const event = createSecurityAuditEvent({
    id: "audit-1",
    actorId: "root-1",
    action: "identity.role.changed",
    targetType: "User",
    targetId: "user-1",
    requestId: "request-1",
    changes: { roles: [Role.ADMIN], token: "must-not-leak", passwordHash: "must-not-leak", unexpectedPayload: { secret: "must-not-leak" } },
    occurredAt: new Date("2026-08-16T00:00:00.000Z")
  });
  assert.deepEqual(event.changes, { roles: [Role.ADMIN] });
  assert.equal(event.occurredAt, "2026-08-16T00:00:00.000Z");
});
