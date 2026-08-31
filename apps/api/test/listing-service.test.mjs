import assert from "node:assert/strict";
import test from "node:test";
import { createListingService, ListingError } from "../src/modules/listing/listing-service.mjs";
import { ListingStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { drafts: [], publishes: [], prices: [], finds: [], passports: [] };
  const repository = {
    async createDraft(record) { calls.drafts.push(record); return record; },
    async publish(id, slug, now) { calls.publishes.push({ id, slug, now }); return { status: "published", record: { id, publicSlug: slug, status: ListingStatus.PUBLISHED } }; },
    async createPrice(record) { calls.prices.push(record); return record; },
    async findById(id) { calls.finds.push(id); return id === "l1" ? { id, inventoryItemId: "inv-1", status: ListingStatus.DRAFT, publicSlug: null, publishedAt: null } : null; },
    async findInventoryItemStatus() { return "APPROVED"; },
    async listModelSpecifications() { return [{ key: "storage", label: "Storage", dataType: "TEXT", unit: null, value: "1TB" }]; },
    async listAdmin(filters) { calls.listAdmin = filters; return { records: [{ id: "l1", inventory_item_id: "inv-1", status: "DRAFT", public_slug: null, published_at: null, created_at: "2026-08-16T12:00:00.000Z", pcx_item_id: "PCX-1", model_id: "m1", model_name: "GPU", brand_name: "MSI", category_name: "GPU", condition_grade: "A", current_health_score: 90, price: null }], nextCursor: null }; },
    async findPublicPassport(pcxItemId) { calls.passports.push(pcxItemId); return pcxItemId === "PCX-1" ? { pcx_item_id: "PCX-1", inventory_item_id: "inv-1", listing_id: "l1", model_id: "m1", name: "GPU", category_id: "gpu", brand_id: "b1", status: "PUBLISHED", published_at: "2026-08-16T12:00:00.000Z", price: "15000", serial: "SECRET", media_ids: ["media-1"] } : null; },
    async searchPublished(filters) { calls.searches = filters; return { records: [{ id: "l1", public_slug: "pcx-gaming-tower", inventory_item_id: "inv-1", pcx_item_id: "PCX-1", model_id: "m1", name: "GPU", category_id: "gpu", brand_id: "b1", price: 15000, published_at: "2026-08-16T12:00:00.000Z", cover_media_id: "media-1" }], nextCursor: null }; },
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

test("createDraft requires the inventory item to be APPROVED", async () => {
  const { service } = fixture();
  const draft = await service.createDraft("access", { inventoryItemId: "inv-1" });
  assert.equal(draft.status, ListingStatus.DRAFT);

  const notApproved = fixture({ repository: { async findInventoryItemStatus() { return "RECEIVED"; } } });
  await assert.rejects(notApproved.service.createDraft("access", { inventoryItemId: "inv-1" }), (e) => e.code === "item_not_approved");

  const missing = fixture({ repository: { async findInventoryItemStatus() { return null; } } });
  await assert.rejects(missing.service.createDraft("access", { inventoryItemId: "inv-1" }), (e) => e.code === "invalid_reference");
});

test("publish maps a duplicate active listing/slug constraint to a clean conflict", async () => {
  const duplicate = fixture({ repository: { async publish() { const error = new Error("duplicate key"); error.code = "23505"; throw error; } } });
  await assert.rejects(
    duplicate.service.publish("access", "l1", { publicSlug: "taken" }),
    (error) => error.code === "conflict"
  );

  const unexpected = fixture({ repository: { async publish() { throw new Error("boom"); } } });
  await assert.rejects(
    unexpected.service.publish("access", "l1", { publicSlug: "taken" }),
    (error) => error.code !== "conflict"
  );
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

test("listAdmin requires pricing read and maps snake_case admin rows", async () => {
  const { service, calls } = fixture();
  const result = await service.listAdmin("access", {});
  assert.equal(result.data[0].modelName, "GPU");
  assert.equal(result.data[0].pcxItemId, "PCX-1");
  assert.equal(result.data[0].brandName, "MSI");
  assert.equal(result.data[0].categoryName, "GPU");
  assert.equal(result.data[0].conditionGrade, "A");
  assert.equal(result.data[0].currentHealthScore, 90);
  assert.equal(result.data[0].price, null);
  assert.equal(result.meta.nextCursor, null);
  assert.deepEqual(calls.listAdmin, {});

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.listAdmin("access", {}), (error) => error.code === "forbidden");
});

test("public search returns safe listing cards with pagination meta", async () => {
  const { service, calls } = fixture();
  const result = await service.searchPublic({ categoryId: "gpu", q: "GPU", limit: 10, sort: "newest" });
  assert.equal(result.data[0].pcxItemId, "PCX-1");
  assert.equal(result.data[0].coverMediaId, "media-1");
  assert.equal(Object.hasOwn(result.data[0], "serial"), false);
  assert.equal(Object.hasOwn(result.data[0], "acquisitionCost"), false);
  assert.deepEqual(result.meta, { nextCursor: null });
  assert.equal(calls.searches.categoryId, "gpu");
});

test("public passport maps snake_case row and never leaks serial or internal fields", async () => {
  const { service } = fixture();
  const passport = await service.publicPassport("PCX-1");
  assert.notEqual(passport, null);
  assert.equal(passport.pcxItemId, "PCX-1");
  assert.equal(passport.modelId, "m1");
  assert.equal(passport.categoryId, "gpu");
  assert.equal(passport.brandId, "b1");
  assert.equal(passport.status, "PUBLISHED");
  assert.equal(passport.price, 15000);
  assert.deepEqual(passport.mediaIds, ["media-1"]);
  assert.deepEqual(passport.specifications, [{ key: "storage", label: "Storage", dataType: "TEXT", unit: null, value: "1TB" }]);
  assert.equal(Object.hasOwn(passport, "serial"), false);
  assert.equal(await service.publicPassport("missing"), null);
});
