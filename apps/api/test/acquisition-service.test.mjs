import assert from "node:assert/strict";
import test from "node:test";
import { createAcquisitionService, AcquisitionError } from "../src/modules/acquisition/acquisition-service.mjs";
import { OfferStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { offers: [], accepts: [], rejections: [], owners: [], acquisitions: [], foundOffers: [], foundAcq: [], paid: [] };
  const offer = { id: "o1", sellRequestId: "sr1", amount: 7000, status: OfferStatus.ACCEPTED, expiresAt: "2026-08-17T00:00:00.000Z" };
  const repository = {
    async createOffer(record) { calls.offers.push(record); return record; },
    async acceptOffer(offerId, now) { calls.accepts.push({ offerId, now }); return { status: "accepted", record: { ...offer, id: offerId, status: OfferStatus.ACCEPTED } }; },
    async rejectOffer(offerId) { calls.rejections.push(offerId); return { ...offer, id: offerId, status: OfferStatus.REJECTED }; },
    async findOwnerUserIdByOffer(offerId) { calls.owners.push(offerId); return offerId === "o1" ? "customer-1" : null; },
    async findOfferById(id) { calls.foundOffers.push(id); return id === "o1" ? offer : null; },
    async createAcquisition(record, acceptedOffer) { calls.acquisitions.push({ record, acceptedOffer }); return record; },
    async findByOffer() { calls.foundAcq.push(); return null; },
    async markPaid(acquisitionId, now) { calls.paid.push({ acquisitionId, now }); return { status: "paid", record: { id: acquisitionId, paymentStatus: "PAID" } }; },
    async findOwnerUserIdBySellRequest() { return "customer-1"; },
    async listOffersBySellRequest() { return []; },
    ...overrides.repository
  };
  const service = createAcquisitionService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

function customerFixture(overrides = {}) {
  return fixture({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    ...overrides
  });
}

test("offer is server-owned with actor identity", async () => {
  const { service, calls } = fixture();
  const offer = await service.createOffer("access", { sellRequestId: "sr1", amount: 1500, expiresAt: "2026-08-17T00:00:00.000Z" });
  assert.equal(offer.createdBy, "admin-1");
  assert.equal(offer.status, OfferStatus.ACTIVE);
  assert.equal(offer.sellRequestId, "sr1");
  assert.equal(offer.amount, 1500);
  assert.equal(calls.offers.length, 1);
  assert.equal(calls.offers[0].amount, 1500);
});

test("offer rejects a client-supplied status and unknown fields", async () => {
  const { service } = fixture();
  await assert.rejects(service.createOffer("access", { sellRequestId: "sr1", amount: 1500, expiresAt: "2026-08-17T00:00:00.000Z", status: "ACCEPTED" }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createOffer("access", { sellRequestId: "sr1", amount: 0, expiresAt: "2026-08-17T00:00:00.000Z" }), (error) => error.code === "invalid_input");
});

test("seller can accept or reject their own offer with ownership enforcement", async () => {
  const { service, calls } = customerFixture();
  const accepted = await service.acceptOfferForCustomer("access", "o1");
  assert.equal(accepted.status, OfferStatus.ACCEPTED);
  assert.equal(calls.owners.length, 1);

  const rejected = await service.rejectOfferForCustomer("access", "o1");
  assert.equal(rejected.status, OfferStatus.REJECTED);

  // A different customer (not the owner) cannot act on the offer.
  const foreign = customerFixture({ authService: { async authenticateAccess() { return { userId: "other", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(foreign.service.acceptOfferForCustomer("access", "o1"), (error) => error.code === "forbidden");

  // A non-customer (admin only) is blocked from the public path too.
  await assert.rejects((await fixture()).service.acceptOfferForCustomer("access", "o1"), (error) => error.code === "forbidden");
});

test("seller accept/reject fails for a missing offer", async () => {
  const { service } = customerFixture();
  await assert.rejects(service.acceptOfferForCustomer("access", "missing"), (error) => error.code === "not_found");
  await assert.rejects(service.rejectOfferForCustomer("access", "missing"), (error) => error.code === "not_found");
});

test("acquisition derives immutable agreed price from accepted offer and is idempotent", async () => {
  const { service, calls } = fixture();
  const acquisition = await service.createAcquisition("access", { sellRequestId: "sr1", acceptedOfferId: "o1", sellerUserId: "u2", idempotencyKey: "idem-1" });
  assert.equal(acquisition.agreedPrice, 7000);
  assert.equal(calls.acquisitions.length, 1);
  assert.equal(calls.acquisitions[0].record.agreedPrice, 7000);

  const replay = fixture({ repository: { async findOfferById() { return { id: "o1", sellRequestId: "sr1", amount: 7000, status: OfferStatus.ACCEPTED }; }, async findByOffer() { return { id: "existing" }; } } });
  assert.equal((await replay.service.createAcquisition("access", { sellRequestId: "sr1", acceptedOfferId: "o1", sellerUserId: "u2", idempotencyKey: "idem-1" })).id, "existing");
});

test("acquisition rejects unknown fields, non-admin, and non-accepted offer", async () => {
  const { service } = fixture();
  await assert.rejects(service.createAcquisition("access", { sellRequestId: "sr", acceptedOfferId: "o1", sellerUserId: "u", idempotencyKey: "k", agreedPrice: 1 }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createAcquisition("access", { sellRequestId: "sr", acceptedOfferId: "missing", sellerUserId: "u", idempotencyKey: "k" }), (error) => error.code === "not_found");

  const notAccepted = fixture({ repository: { async findOfferById() { return { id: "o1", amount: 1, status: OfferStatus.ACTIVE }; } } });
  await assert.rejects(notAccepted.service.createAcquisition("access", { sellRequestId: "sr", acceptedOfferId: "o1", sellerUserId: "u", idempotencyKey: "k" }), (error) => error.code === "invalid_state");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.createOffer("access", { sellRequestId: "sr", amount: 1, expiresAt: "2026-08-17T00:00:00.000Z" }), (error) => error.code === "forbidden");
});

test("markAcquisitionPaid is permission-gated and rejects non-payable state", async () => {
  const { service, calls } = fixture();
  const paid = await service.markAcquisitionPaid("access", "a1");
  assert.equal(paid.paymentStatus, "PAID");
  assert.equal(calls.paid.length, 1);
  assert.equal(calls.paid[0].acquisitionId, "a1");

  const notPayable = fixture({ repository: { async markPaid() { return { status: "not_payable" }; } } });
  await assert.rejects(notPayable.service.markAcquisitionPaid("access", "a1"), (error) => error.code === "invalid_state");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.markAcquisitionPaid("access", "a1"), (error) => error.code === "forbidden");
});
