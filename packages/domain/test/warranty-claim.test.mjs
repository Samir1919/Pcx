import assert from "node:assert/strict";
import test from "node:test";
import { ClaimStatus, createClaim, createClaimResolution, createWarranty, ResolutionType, WarrantyStatus } from "../src/index.mjs";

test("warranty is ACTIVE with a valid time window and unique per item", () => {
  const warranty = createWarranty({ id: "w1", orderItemId: "oi1", inventoryItemId: "inv-1", policySnapshot: { days: 365 }, startsAt: "2026-08-16T00:00:00.000Z", endsAt: "2027-08-16T00:00:00.000Z" });
  assert.equal(warranty.status, WarrantyStatus.ACTIVE);
  assert.equal(warranty.policySnapshot.days, 365);
  assert.throws(() => createWarranty({ id: "w", orderItemId: "oi", inventoryItemId: "inv", endsAt: "2026-08-16T00:00:00.000Z", startsAt: "2027-08-16T00:00:00.000Z" }), /after/);
});

test("claim is REQUESTED with server-owned lifecycle and resolution is typed", () => {
  const claim = createClaim({ id: "c1", warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD", symptoms: "no power" });
  assert.equal(claim.status, ClaimStatus.REQUESTED);
  assert.equal(claim.resolvedAt, null);

  const resolution = createClaimResolution({ id: "cr1", claimId: "c1", resolutionType: ResolutionType.REPLACE, costAmount: 0, approvedBy: "u1" });
  assert.equal(resolution.resolutionType, "REPLACE");
  assert.throws(() => createClaimResolution({ id: "cr", claimId: "c", resolutionType: "BOGUS", approvedBy: "u" }), /invalid/);
  assert.throws(() => createClaimResolution({ id: "cr", claimId: "c", resolutionType: ResolutionType.REPAIR, costAmount: -1, approvedBy: "u" }), /non-negative/);
});
