import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptOffer,
  AcquisitionPaymentStatus,
  AcquisitionSourceType,
  createAcquisition,
  createOffer,
  markAcquisitionPaid,
  OfferStatus,
  rejectOffer
} from "../src/index.mjs";

test("offer is final, server-owned, and only ACTIVE offers can be accepted", () => {
  const offer = createOffer({ id: "o1", sellRequestId: "sr1", amount: 7000, createdBy: "u1", expiresAt: "2026-08-17T00:00:00.000Z", createdAt: "2026-08-16T00:00:00.000Z" });
  assert.equal(offer.status, OfferStatus.ACTIVE);
  assert.equal(offer.acceptedAt, null);
  assert.equal(offer.sellRequestId, "sr1");
  assert.equal(offer.amount, 7000);

  const accepted = acceptOffer(offer, { acceptedAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(accepted.status, OfferStatus.ACCEPTED);
  assert.equal(accepted.acceptedAt, "2026-08-16T12:00:00.000Z");
  assert.throws(() => acceptOffer(accepted), /ACTIVE/);
  assert.throws(() => createOffer({ id: "o", sellRequestId: "sr", amount: 0, createdBy: "u", expiresAt: "2026-08-17T00:00:00.000Z" }), /positive amount/);
  assert.throws(() => createOffer({ id: "o", sellRequestId: "sr", amount: 1, createdBy: "u", expiresAt: "bad" }), /valid timestamp/);
});

test("rejectOffer is terminal for ACTIVE offers", () => {
  const offer = createOffer({ id: "o1", sellRequestId: "sr1", amount: 7000, createdBy: "u1", expiresAt: "2026-08-17T00:00:00.000Z" });
  const rejected = rejectOffer(offer);
  assert.equal(rejected.status, OfferStatus.REJECTED);
  assert.throws(() => rejectOffer(rejected), /ACTIVE/);
});

test("acquisition captures immutable agreed price and requires idempotency key", () => {
  const acquisition = createAcquisition({ id: "a1", sellRequestId: "sr1", acceptedOfferId: "o1", sellerUserId: "u2", sourceType: AcquisitionSourceType.SELL_TO_PCX, agreedPrice: 7000, acquiredAt: "2026-08-16T12:00:00.000Z", idempotencyKey: "idem-1" });
  assert.equal(acquisition.agreedPrice, 7000);
  assert.equal(acquisition.paymentStatus, AcquisitionPaymentStatus.PENDING);
  assert.throws(() => createAcquisition({ id: "a", sellRequestId: "sr", acceptedOfferId: "o", sellerUserId: "u", agreedPrice: 0, idempotencyKey: "k" }), /positive amount/);
  assert.throws(() => createAcquisition({ id: "a", sellRequestId: "sr", acceptedOfferId: "o", sellerUserId: "u", agreedPrice: 1 }), /idempotencyKey/);
});

test("acquisition payment is server-owned and only PENDING can be marked PAID", () => {
  const acquisition = createAcquisition({ id: "a1", sellRequestId: "sr1", acceptedOfferId: "o1", sellerUserId: "u2", agreedPrice: 7000, acquiredAt: "2026-08-16T12:00:00.000Z", idempotencyKey: "idem-1" });
  const paid = markAcquisitionPaid(acquisition, { paidAt: "2026-08-16T13:00:00.000Z" });
  assert.equal(paid.paymentStatus, AcquisitionPaymentStatus.PAID);
  assert.equal(paid.paidAt, "2026-08-16T13:00:00.000Z");
  assert.equal(paid.agreedPrice, 7000);
  assert.throws(() => markAcquisitionPaid(paid), /PENDING/);
  assert.throws(() => markAcquisitionPaid(null), /acquisition is required/);
});
