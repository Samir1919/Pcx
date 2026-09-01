import assert from "node:assert/strict";
import test from "node:test";
import { archiveListing, createListing, createListingPrice, createPublicListing, createPublicPassport, ListingStatus, pauseListing, publishListing, unpublishListing } from "../src/index.mjs";

test("listing is created as DRAFT and publishes only from DRAFT/PAUSED with canonical slug", () => {
  const listing = createListing({ id: "l1", inventoryItemId: "inv-1", publicSlug: null, createdAt: "2026-08-16T00:00:00.000Z" });
  assert.equal(listing.status, ListingStatus.DRAFT);
  assert.equal(listing.publishedAt, null);

  const published = publishListing(listing, { publicSlug: "pcx-gaming-tower", publishedAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(published.status, ListingStatus.PUBLISHED);
  assert.equal(published.publicSlug, "pcx-gaming-tower");
  assert.equal(published.publishedAt, "2026-08-16T12:00:00.000Z");

  assert.throws(() => publishListing(published), /DRAFT or PAUSED/);
  assert.throws(() => publishListing(listing, { publicSlug: "Bad Slug" }), /slug/);
});

test("listing lifecycle: pause only from PUBLISHED, unpublish from PUBLISHED/PAUSED, archive from active states", () => {
  const draft = createListing({ id: "l1", inventoryItemId: "inv-1", createdAt: "2026-08-16T00:00:00.000Z" });
  const published = publishListing(draft, { publicSlug: "slug-1", publishedAt: "2026-08-16T12:00:00.000Z" });

  const paused = pauseListing(published);
  assert.equal(paused.status, ListingStatus.PAUSED);
  assert.throws(() => pauseListing(draft), /PUBLISHED/);
  assert.throws(() => pauseListing(paused), /PUBLISHED/);

  const unpublished = unpublishListing(paused, { unpublishedAt: "2026-08-16T13:00:00.000Z" });
  assert.equal(unpublished.status, ListingStatus.DRAFT);
  assert.equal(unpublished.unpublishedAt, "2026-08-16T13:00:00.000Z");
  assert.throws(() => unpublishListing(draft), /PUBLISHED or PAUSED/);

  assert.equal(archiveListing(published).status, ListingStatus.ARCHIVED);
  assert.equal(archiveListing(archiveListing(published)).status, ListingStatus.ARCHIVED); // idempotent
  assert.throws(() => archiveListing({ ...published, status: ListingStatus.SOLD }), /SOLD or RESERVED/);
  assert.throws(() => archiveListing({ ...published, status: ListingStatus.RESERVED }), /SOLD or RESERVED/);
});

test("listing price requires positive amount and monotonically increasing validity", () => {
  const price = createListingPrice({ id: "p1", listingId: "l1", price: 15000, validFrom: "2026-08-16T00:00:00.000Z", setByUser: "u1" });
  assert.equal(price.price, 15000);
  assert.throws(() => createListingPrice({ id: "p", listingId: "l", price: 0, setByUser: "u" }), /positive amount/);
  assert.throws(() => createListingPrice({ id: "p", listingId: "l", price: 10, validFrom: "2026-08-17T00:00:00.000Z", validTo: "2026-08-16T00:00:00.000Z", setByUser: "u" }), /validTo/);
});

test("public listing card exposes only approved disclosure fields", () => {
  const listing = createPublicListing({
    id: "l1",
    publicSlug: "pcx-gaming-tower",
    inventoryItemId: "inv-1",
    pcxItemId: "PCX-1",
    modelId: "m1",
    name: "GPU",
    categoryId: "gpu",
    brandId: "msi",
    grade: "A",
    healthScore: 90,
    price: 15000,
    publishedAt: "2026-08-16T12:00:00.000Z",
    coverMediaId: "media-1"
  });
  assert.equal(listing.pcxItemId, "PCX-1");
  assert.equal(listing.coverMediaId, "media-1");
  assert.equal(Object.hasOwn(listing, "serial"), false);
  assert.equal(Object.hasOwn(listing, "acquisitionCost"), false);
});

test("public passport exposes only approved disclosure fields", () => {
  const passport = createPublicPassport({
    pcxItemId: "PCX-1",
    inventoryItemId: "inv-1",
    listingId: "l1",
    modelId: "m1",
    name: "GPU",
    categoryId: "gpu",
    brandId: "msi",
    grade: "A",
    healthScore: 90,
    price: 15000,
    status: "PUBLISHED",
    publishedAt: "2026-08-16T12:00:00.000Z",
    mediaIds: ["media-1", "media-2"]
  });
  assert.equal(passport.pcxItemId, "PCX-1");
  assert.deepEqual(passport.mediaIds, ["media-1", "media-2"]);
  assert.equal(Object.hasOwn(passport, "serial"), false);
  assert.equal(Object.hasOwn(passport, "acquisitionCost"), false);
  assert.equal(Object.hasOwn(passport, "technicianNotes"), false);
  assert.deepEqual(passport.specifications, []);
});
