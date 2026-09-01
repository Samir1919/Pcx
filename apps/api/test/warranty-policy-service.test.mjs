import assert from "node:assert/strict";
import test from "node:test";
import { createWarrantyPolicyService, WarrantyPolicyError } from "../src/modules/warranty/warranty-policy-service.mjs";

function fixture(overrides = {}) {
  const calls = { created: [], listed: [], archived: [], found: [] };
  const repository = {
    async create(record) { calls.created.push(record); return record; },
    async list() { calls.listed.push(); return [{ id: "p1", name: "12-month", status: "ACTIVE" }]; },
    async findById(id) { calls.found.push(id); return id === "p1" ? { id: "p1", name: "12-month", durationDays: 365, coverageSummary: "Parts", terms: null, status: "ACTIVE", createdAt: "2026-08-16T00:00:00.000Z", archivedAt: null } : null; },
    async archive(id, now) { calls.archived.push({ id, now }); return { id, status: "ARCHIVED", archivedAt: now }; },
    ...overrides.repository
  };
  const service = createWarrantyPolicyService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("policy authoring requires SYSTEM_CONFIGURE and validates shape", async () => {
  const { service, calls } = fixture();
  const policy = await service.create("access", { name: "12-month hardware", durationDays: 365, coverageSummary: "Parts & labor" });
  assert.equal(policy.id, "id-1");
  assert.equal(calls.created.length, 1);

  await assert.rejects(service.create("access", { name: "x", durationDays: 0, coverageSummary: "c" }), (e) => e instanceof WarrantyPolicyError && e.code === "invalid_input");
  await assert.rejects(service.create("access", { name: "x", durationDays: 30, coverageSummary: "c", status: "ACTIVE" }), (e) => e.code === "invalid_input");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.create("access", { name: "x", durationDays: 30, coverageSummary: "c" }), (e) => e.code === "forbidden");
});

test("archive is append-only and requires an existing ACTIVE policy", async () => {
  const { service, calls } = fixture();
  const archived = await service.archive("access", "p1");
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(calls.archived.length, 1);

  await assert.rejects(service.archive("access", "missing"), (e) => e.code === "not_found");
});
