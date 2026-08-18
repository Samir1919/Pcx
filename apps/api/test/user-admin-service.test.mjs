import assert from "node:assert/strict";
import test from "node:test";
import { createUserAdminService, UserAdminError } from "../src/modules/identity/user-admin-service.mjs";
import { Role } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { audits: [], statuses: [], roles: [], disables: [] };
  const repository = {
    async list(filters) { return { rows: [{ id: "u1", email: "bob@example.com", phone: null, status: "ACTIVE", contact_verified: true, roles: ["CUSTOMER"], created_at: "2026-08-16T12:00:00.000Z" }], nextCursor: null }; },
    async findRoles(userId) { return userId === "u1" ? ["CUSTOMER"] : null; },
    async findStatus(userId) { return userId === "u1" ? { id: "u1", status: "ACTIVE" } : null; },
    async updateStatus({ userId, status, actorId }) { calls.statuses.push({ userId, status, actorId }); return { id: userId, status, roles: [] }; },
    async replaceRoles({ userId, roles, actorId }) { calls.roles.push({ userId, roles, actorId }); return roles; },
    async recordAudit(event) { calls.audits.push(event); },
    async disableRefreshSessions(userId) { calls.disables.push(userId); },
    ...overrides.repository
  };
  const service = createUserAdminService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `audit-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

test("list requires identity:read permission and returns repository rows", async () => {
  const { service } = fixture();
  const result = await service.list("access", {});
  assert.equal(result.data[0].id, "u1");
  // Masking is a repository concern; the service passes repository rows through.
  assert.equal(result.data[0].email, "bob@example.com");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.list("access", {}), (error) => error.code === "forbidden");
});

test("updateStatus blocks self and non-staff", async () => {
  const { service } = fixture();
  await assert.rejects(service.updateStatus("access", "admin-1", "ACTIVE"), (error) => error.code === "self_change_blocked");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.updateStatus("access", "u1", "SUSPENDED"), (error) => error.code === "forbidden");

  const ok = fixture();
  await ok.service.updateStatus("access", "u1", "SUSPENDED");
  assert.equal(ok.calls.statuses.length, 1);
  assert.equal(ok.calls.disables.length, 1);
});

test("replaceRoles requires role:assign and guards escalation", async () => {
  const { service, calls } = fixture();
  await service.replaceRoles("access", "u1", ["MERCHANT"]);
  assert.deepEqual(calls.roles[0].roles, ["MERCHANT"]);
  assert.equal(calls.audits.length, 1);

  // Self elevation is blocked via authorizeRoleAssignment.
  await assert.rejects(service.replaceRoles("access", "admin-1", ["MERCHANT"]), (error) => error.code === "self_change_blocked");

  // ADMIN cannot grant SUPER_ADMIN.
  await assert.rejects(service.replaceRoles("access", "u1", ["SUPER_ADMIN"]), (error) => error.code === "super_admin_required");
});

test("customer cannot manage users", async () => {
  const den = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(den.service.replaceRoles("access", "u1", ["MERCHANT"]), (error) => error.code === "forbidden");
});
