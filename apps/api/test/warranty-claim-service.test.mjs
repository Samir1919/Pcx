import assert from "node:assert/strict";
import test from "node:test";
import { createWarrantyClaimService } from "../src/modules/warranty/warranty-claim-service.mjs";
import { ClaimStatus, ResolutionType, WarrantyStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { warranties: [], claims: [], resolutions: [] };
  const repository = {
    async createWarranty(record) { calls.warranties.push(record); return record; },
    async createClaim(record) { calls.claims.push(record); return record; },
    async createResolution(record) { calls.resolutions.push(record); return record; },
    async findWarrantyById(id) { return id === "w1" ? { id, status: WarrantyStatus.ACTIVE } : null; },
    async findWarrantyOwnerUserId(id) { return id === "w1" ? "customer-1" : null; },
    async markClaimResolved() { return { status: "resolved", record: { id: "c1", status: ClaimStatus.RESOLVED } }; },
    async listWarranties() { return []; },
    async listClaims() { return []; },
    ...overrides.repository
  };
  const service = createWarrantyClaimService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

test("warranty creation requires inventory/system permission", async () => {
  const { service, calls } = fixture();
  const result = await service.createWarranty("access", { orderItemId: "oi1", inventoryItemId: "inv-1", endsAt: "2027-08-16T00:00:00.000Z" });
  assert.equal(result.status, WarrantyStatus.ACTIVE);
  assert.equal(calls.warranties.length, 1);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.createWarranty("access", { orderItemId: "oi", inventoryItemId: "inv", endsAt: "2027-01-01T00:00:00.000Z" }), (error) => error.code === "forbidden");
});

test("customer can open a claim on their own warranty with ownership enforced", async () => {
  const { service } = fixture({ authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  const claim = await service.createClaimForCustomer("access", { warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" });
  assert.equal(claim.status, ClaimStatus.REQUESTED);

  // A different customer is not the warranty owner.
  const foreign = fixture({ authService: { async authenticateAccess() { return { userId: "other", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(foreign.service.createClaimForCustomer("access", { warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" }), (error) => error.code === "forbidden");
});

test("claim requires ACTIVE warranty and resolve records resolution", async () => {
  const { service, calls } = fixture();
  const claim = await service.createClaim("access", { warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" });
  assert.equal(claim.status, ClaimStatus.REQUESTED);

  await assert.rejects(service.createClaim("access", { warrantyId: "missing", orderItemId: "oi1", reasonCode: "DEAD" }), (error) => error.code === "invalid_state");

  const resolved = await service.resolveClaim("access", { claimId: "c1", resolutionType: ResolutionType.REPLACE, costAmount: 0 });
  assert.equal(resolved.claim.status, ClaimStatus.RESOLVED);
  assert.equal(calls.resolutions.length, 1);
  assert.equal(resolved.resolution.approvedBy, "admin-1");
});
