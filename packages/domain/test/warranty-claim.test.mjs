import assert from "node:assert/strict";
import test from "node:test";
import { ClaimStatus, createClaim, createClaimResolution, createWarranty, createWarrantyPolicy, archiveWarrantyPolicy, toWarrantyPolicySnapshot, linkClaimInspection, linkClaimShipment, ResolutionType, WarrantyPolicyStatus, WarrantyStatus } from "../src/index.mjs";

test("warranty policy is authored ACTIVE, archives immutably, and snapshots coverage", () => {
  const policy = createWarrantyPolicy({ id: "p1", name: "12-month hardware", durationDays: 365, coverageSummary: "Parts & labor", terms: "Covers defects" });
  assert.equal(policy.status, WarrantyPolicyStatus.ACTIVE);
  assert.equal(policy.durationDays, 365);
  assert.equal(policy.archivedAt, null);
  assert.throws(() => createWarrantyPolicy({ id: "p", name: "x", durationDays: 0, coverageSummary: "c" }), /positive integer/);
  assert.throws(() => createWarrantyPolicy({ id: "p", name: "x", durationDays: 30, coverageSummary: "" }), /coverageSummary/);

  const archived = archiveWarrantyPolicy(policy, { archivedAt: "2026-09-02T00:00:00.000Z" });
  assert.equal(archived.status, WarrantyPolicyStatus.ARCHIVED);
  assert.equal(archived.archivedAt, "2026-09-02T00:00:00.000Z");
  assert.equal(policy.status, WarrantyPolicyStatus.ACTIVE);

  const snapshot = toWarrantyPolicySnapshot(policy);
  assert.equal(snapshot.policyId, "p1");
  assert.equal(snapshot.durationDays, 365);
  assert.equal(snapshot.coverageSummary, "Parts & labor");
  assert.equal(toWarrantyPolicySnapshot(null), null);
});

test("linkClaimInspection moves REQUESTED to IN_REVIEW and requires REQUESTED", () => {
  const claim = createClaim({ id: "c1", warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" });
  assert.equal(claim.inspectionId, null);
  const linked = linkClaimInspection(claim, "insp-1");
  assert.equal(linked.status, ClaimStatus.IN_REVIEW);
  assert.equal(linked.inspectionId, "insp-1");
  assert.equal(claim.status, ClaimStatus.REQUESTED);
  assert.throws(() => linkClaimInspection({ ...claim, status: ClaimStatus.IN_REVIEW }, "insp-1"), /REQUESTED/);
});

test("linkClaimShipment records the return/pickup shipment on a claim", () => {
  const claim = createClaim({ id: "c1", warrantyId: "w1", orderItemId: "oi1", reasonCode: "DEAD" });
  assert.equal(claim.shipmentId, null);
  const linked = linkClaimShipment(claim, "ship-1");
  assert.equal(linked.shipmentId, "ship-1");
  assert.equal(claim.shipmentId, null);
  assert.throws(() => linkClaimShipment(claim, ""), /shipmentId/);
});

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
