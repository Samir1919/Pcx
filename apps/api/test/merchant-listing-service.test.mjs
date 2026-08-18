import assert from "node:assert/strict";
import test from "node:test";
import { createMerchantListingService, MerchantListingError } from "../src/modules/listing/merchant-listing-service.mjs";
import { ListingStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { created: [], updated: [], archived: [], lists: [] };
  const draft = { id: "l1", ownerUserId: "merchant-1", productModelId: "m1", status: ListingStatus.DRAFT, proposedPrice: 15000, createdAt: "2026-08-16T12:00:00.000Z" };
  const repository = {
    async createDraft(record) { calls.created.push(record); return record; },
    async findOwnedById(id) { return id === "l1" ? draft : null; },
    async listForOwner(ownerUserId, filters) { calls.lists.push({ ownerUserId, filters }); return { rows: [draft], nextCursor: null }; },
    async updateDraft(input) { calls.updated.push(input); return { ...draft, ...input }; },
    async archiveDraft(input) { calls.archived.push(input); return { ...draft, status: ListingStatus.ARCHIVED }; },
    ...overrides.repository
  };
  const service = createMerchantListingService({
    authService: { async authenticateAccess() { return { userId: "merchant-1", status: "ACTIVE", roles: ["MERCHANT"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

test("createDraft requires merchant management permission and positive proposed price", async () => {
  const { service, calls } = fixture();
  await service.createDraft("access", { productModelId: "m1", proposedPrice: 15000 });
  assert.equal(calls.created[0].ownerUserId, "merchant-1");
  assert.equal(calls.created[0].productModelId, "m1");

  await assert.rejects(service.createDraft("access", { productModelId: "m1", proposedPrice: 0 }), (error) => error.code === "invalid_input");
  await assert.rejects(service.createDraft("access", { productModelId: "" }), (error) => error.code === "invalid_input");
});

test("updateDraft is owner-scoped and DRAFT-only", async () => {
  const { service } = fixture();
  await service.updateDraft("access", "l1", { proposedPrice: 25000 });

  const stranger = fixture({ authService: { async authenticateAccess() { return { userId: "merchant-2", status: "ACTIVE", roles: ["MERCHANT"] }; } } });
  await assert.rejects(stranger.service.updateDraft("access", "l1", { proposedPrice: 25000 }), (error) => error.code === "forbidden");

  const nonDraft = fixture({ repository: { async findOwnedById() { return { id: "l1", ownerUserId: "merchant-1", status: "PUBLISHED", proposedPrice: 15000 }; } } });
  await assert.rejects(nonDraft.service.updateDraft("access", "l1", { proposedPrice: 25000 }), (error) => error.code === "invalid_state");
});

test("archiveDraft is owner-scoped", async () => {
  const { service } = fixture();
  const archived = await service.archiveDraft("access", "l1");
  assert.equal(archived.status, ListingStatus.ARCHIVED);

  const customer = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(customer.service.list("access", {}), (error) => error.code === "forbidden");
});

test("customer and admin (without merchant permission) are denied", async () => {
  const admin = fixture({ authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } } });
  await assert.rejects(admin.service.createDraft("access", { productModelId: "m1", proposedPrice: 10 }), (error) => error.code === "forbidden");
});
