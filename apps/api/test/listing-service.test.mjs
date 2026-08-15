import assert from "node:assert/strict";
import test from "node:test";
import { createListingService, ListingError } from "../src/modules/listing/listing-service.mjs";
import { ListingStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { drafts: [], publishes: [], prices: [], finds: [], passports: [] };
  const repository = {
    async createDraft(record) { calls.drafts.push(record); return record; },
    async publish(id, slug, now) { calls.publishes.push({ id, slug, now }); return { status: "published", record: { id, publicSlug: slug, status: ListingStatus.PUBLISHED } }; },
    async createPrice(record) { calls.prices.push(record); return record; },
    async findById(id) { calls.finds.push(id); return id === "l1" ? { id, inventoryItemId: "inv-1", status: ListingStatus.DRAFT, publicSlug: null, publishedAt: null } : null; },
    async findPublicPassport(pcxItemId) { calls.passports.push(pcxItemId); return pcxItemId === "PCX-1" ? { pcxItemId, modelId: "m1", name: "GPU", categoryId: "gpu", brandId: "b1", status: "PUBLISHED", publishedAt: "2026-08-16T12:00:00.000Z", price: 15000, serial: "SECRET" } : null; },
    ...overrides.repository
  };
  const service = createListingService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, calls };
}

test("createDraft and publish are permission-gated with server-owned status", async () => {
  const { service, calls } = fixture();
  const draft = await service.createDraft("access", { inventoryItemId: "inv-1", publicSlug: "pcx-gaming-tower" });
  assert.equal(draft.status, ListingStatus.DRAFT);
  const published = await service.publish("access", "l1", { publicSlug: "pcx-gaming-tower" });
  assert.equal(published.status, ListingStatus.PUBLISHED);
  assert.equal(calls.publishes.length, 1);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.createDraft("access", { inventoryItemId: "inv-1" }), (error) => error.code === "forbidden");
});

test("setPrice requires pricing permission and positive server-owned amount", async () => {
  const { service, calls } = fixture();
  const price = await service.setPrice("access", { listingId: "l1", price: 15000 });
  assert.equal(price.price, 15000);
  assert.equal(price.setByUser, "admin-1");
  assert.equal(calls.prices.length, 1);
  await assert.rejects(service.setPrice("access", { listingId: "l1", price: 0 }), (error) => error.code === "invalid_input");
  await assert.rejects(service.setPrice("access", { listingId: "missing", price: 10 }), (error) => error.code === "not_found");
});

test("public passport never leaks serial or internal fields", async () => {
  const { service } = fixture();
  const passport = await service.publicPassport("PCX-1");
  assert.equal(passport.pcxItemId, "PCX-1");
  assert.equal(Object.hasOwn(passport, "serial"), false);
  assert.equal(await service.publicPassport("missing"), null);
});
