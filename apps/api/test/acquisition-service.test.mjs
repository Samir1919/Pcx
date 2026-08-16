import assert from "node:assert/strict";
import test from "node:test";
import { createAcquisitionService, AcquisitionError } from "../src/modules/acquisition/acquisition-service.mjs";
import { OfferStatus, ValuationType } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { valuations: [], offers: [], accepts: [], acquisitions: [], foundOffers: [], foundAcq: [] };
  const offer = { id: "o1", sellRequestId: "sr1", valuationId: "v1", amount: 7000, status: OfferStatus.ACCEPTED, expiresAt: "2026-08-17T00:00:00.000Z" };
  const repository = {
    async createValuation(record) { calls.valuations.push(record); return record; },
    async createOffer(record) { calls.offers.push(record); return record; },
    async acceptOffer(offerId, now) { calls.accepts.push({ offerId, now }); return { status: "accepted", record: { ...offer, id: offerId, status: OfferStatus.ACCEPTED } }; },
    async findOfferById(id) { calls.foundOffers.push(id); return id === "o1" ? offer : null; },
    async createAcquisition(record, acceptedOffer) { calls.acquisitions.push({ record, acceptedOffer }); return record; },
    async findByOffer() { calls.foundAcq.push(); return null; },
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

test("valuation and offer are server-owned with actor identity", async () => {
  const { service, calls } = fixture();
  const valuation = await service.createValuation("access", { sellRequestId: "sr1", valuationType: ValuationType.PRELIMINARY, lowValue: 1000, highValue: 2000 });
  assert.equal(valuation.createdBy, "admin-1");
  const offer = await service.createOffer("access", { sellRequestId: "sr1", valuationId: "v1", amount: 1500, expiresAt: "2026-08-17T00:00:00.000Z" });
  assert.equal(offer.createdBy, "admin-1");
  assert.equal(offer.status, OfferStatus.ACTIVE);
  assert.equal(calls.valuations.length, 1);
  assert.equal(calls.offers.length, 1);
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
  await assert.rejects(denied.service.createValuation("access", { sellRequestId: "sr", valuationType: "MANUAL" }), (error) => error.code === "forbidden");
});
