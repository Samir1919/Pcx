import assert from "node:assert/strict";
import test from "node:test";
import { advanceSellRequest, createSellRequest, createSellerDeclaration, FulfilmentPreference, SellRequestStatus, SellRequestTransitions, submitSellRequest } from "../src/index.mjs";

test("sell request is created as a server-owned DRAFT with normalized contact", () => {
  const record = createSellRequest({
    id: "sr-1",
    userId: "user-1",
    categoryId: "gpu",
    productModelId: null,
    contactName: " Seller ",
    contactPhone: " 01700000000 ",
    contactEmail: " SELLER@EXAMPLE.COM ",
    fulfilmentPreference: FulfilmentPreference.DROP_OFF,
    createdAt: "2026-08-16T00:00:00.000Z"
  });
  assert.equal(record.status, SellRequestStatus.DRAFT);
  assert.equal(record.userId, "user-1");
  assert.equal(record.contactName, "Seller");
  assert.equal(record.contactPhone, "01700000000");
  assert.equal(record.contactEmail, "seller@example.com");
  assert.equal(record.submittedAt, null);
});

test("sell request only allows DRAFT → SUBMITTED transition and rejects client status", () => {
  const record = createSellRequest({ id: "sr", userId: "u", categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: FulfilmentPreference.PICKUP });
  const submitted = submitSellRequest(record, { submittedAt: "2026-08-16T01:00:00.000Z" });
  assert.equal(submitted.status, SellRequestStatus.SUBMITTED);
  assert.equal(submitted.submittedAt, "2026-08-16T01:00:00.000Z");
  assert.throws(() => submitSellRequest(submitted), /not allowed/);
  assert.throws(() => createSellRequest({ id: "sr", userId: "u", categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: "EXPRESS" }), /fulfilmentPreference/);
  // Extra fields are ignored by the domain factory; client-supplied status is
  // rejected at the application-service boundary, not here.
  assert.equal(createSellRequest({ id: "sr", userId: "u", categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: FulfilmentPreference.PICKUP, status: "SUBMITTED" }).status, SellRequestStatus.DRAFT);
});

test("sell request advances only along the canonical transition graph", () => {
  const base = { id: "sr", userId: "u", categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: FulfilmentPreference.PICKUP };
  const record = createSellRequest(base);

  // Valid multi-step path.
  const submitted = advanceSellRequest(record, SellRequestStatus.SUBMITTED);
  const reviewing = advanceSellRequest(submitted, SellRequestStatus.REVIEWING);
  const inspection = advanceSellRequest(reviewing, SellRequestStatus.INSPECTION_REQUIRED);
  const inspecting = advanceSellRequest(inspection, SellRequestStatus.INSPECTING);
  const offered = advanceSellRequest(inspecting, SellRequestStatus.OFFERED);
  const accepted = advanceSellRequest(offered, SellRequestStatus.ACCEPTED);
  const pending = advanceSellRequest(accepted, SellRequestStatus.ACQUISITION_PENDING);
  const paid = advanceSellRequest(pending, SellRequestStatus.PAID);
  assert.equal(advanceSellRequest(paid, SellRequestStatus.CLOSED).status, SellRequestStatus.CLOSED);

  // Illegal jump.
  assert.throws(() => advanceSellRequest(record, SellRequestStatus.ACCEPTED), /not allowed/);
  // Terminal states reject further movement.
  assert.deepEqual(SellRequestTransitions[SellRequestStatus.CLOSED], []);
  assert.throws(() => advanceSellRequest({ ...record, status: SellRequestStatus.CLOSED }, SellRequestStatus.PAID), /not allowed/);
});

test("seller declaration requires confirmed ownership", () => {
  const declaration = createSellerDeclaration({ id: "d", sellRequestId: "sr", ownershipDeclared: true });
  assert.equal(declaration.ownershipDeclared, true);
  assert.throws(() => createSellerDeclaration({ id: "d", sellRequestId: "sr", ownershipDeclared: false }), /ownership/);
});
