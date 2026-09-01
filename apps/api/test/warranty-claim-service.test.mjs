import assert from "node:assert/strict";
import test from "node:test";
import { createWarrantyClaimService } from "../src/modules/warranty/warranty-claim-service.mjs";
import { ClaimStatus, ResolutionType, WarrantyStatus } from "@pcx/domain";
function fixture(overrides = {}) {
  const calls = { warranties: [], claims: [], resolutions: [], finds: [], linked: [], shipped: [] };
  const repository = {
    async createWarranty(record) { calls.warranties.push(record); return record; },
    async createClaim(record) { calls.claims.push(record); return record; },
    async createResolution(record) { calls.resolutions.push(record); return record; },
    async findWarrantyById(id) { return id === "w1" ? { id, status: WarrantyStatus.ACTIVE } : null; },
    async findWarrantyOwnerUserId(id) { return id === "w1" ? "customer-1" : null; },
    async markClaimResolved() { return { status: "resolved", record: { id: "c1", status: ClaimStatus.RESOLVED } }; },
    async listWarranties() { return []; },
    async listClaims() { return []; },
    async findClaimById(id) { calls.finds.push(id); return id === "c1" ? { id, status: ClaimStatus.REQUESTED } : null; },
    async linkInspection(id, inspectionId) { calls.linked.push({ id, inspectionId }); return { id, inspectionId, status: ClaimStatus.IN_REVIEW }; },
    async linkShipment(id, shipmentId) { calls.shipped.push({ id, shipmentId }); return { id, shipmentId, status: ClaimStatus.IN_REVIEW }; },
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

test("linkInspection links a REQUESTED claim to an inspection and enforces state", async () => {
  const { service, calls } = fixture();
  const linked = await service.linkInspection("access", "c1", "insp-1");
  assert.equal(linked.status, ClaimStatus.IN_REVIEW);
  assert.equal(linked.inspectionId, "insp-1");
  assert.equal(calls.linked.length, 1);

  await assert.rejects(service.linkInspection("access", "missing", "insp-1"), (error) => error.code === "not_found");

  const notRequested = fixture({ repository: { async findClaimById() { return { id: "c1", status: ClaimStatus.IN_REVIEW }; } } });
  await assert.rejects(notRequested.service.linkInspection("access", "c1", "insp-1"), (error) => error.code === "invalid_state");
});

test("linkShipment links a claim to the return/pickup shipment", async () => {
  const { service, calls } = fixture();
  const linked = await service.linkShipment("access", "c1", "ship-1");
  assert.equal(linked.shipmentId, "ship-1");
  assert.equal(calls.shipped.length, 1);
  assert.equal(calls.shipped[0].shipmentId, "ship-1");

  await assert.rejects(service.linkShipment("access", "missing", "ship-1"), (error) => error.code === "not_found");
});
