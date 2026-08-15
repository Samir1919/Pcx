import assert from "node:assert/strict";
import test from "node:test";
import { createListing, createListingPrice, createPublicPassport, ListingStatus, publishListing } from "../src/index.mjs";

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

test("listing price requires positive amount and monotonically increasing validity", () => {
  const price = createListingPrice({ id: "p1", listingId: "l1", price: 15000, validFrom: "2026-08-16T00:00:00.000Z", setByUser: "u1" });
  assert.equal(price.price, 15000);
  assert.throws(() => createListingPrice({ id: "p", listingId: "l", price: 0, setByUser: "u" }), /positive amount/);
  assert.throws(() => createListingPrice({ id: "p", listingId: "l", price: 10, validFrom: "2026-08-17T00:00:00.000Z", validTo: "2026-08-16T00:00:00.000Z", setByUser: "u" }), /validTo/);
});

test("public passport exposes only approved disclosure fields", () => {
  const passport = createPublicPassport({
    pcxItemId: "PCX-1",
    modelId: "m1",
    name: "GPU",
    categoryId: "gpu",
    brandId: "msi",
    grade: "A",
    healthScore: 90,
    price: 15000,
    status: "PUBLISHED",
    publishedAt: "2026-08-16T12:00:00.000Z"
  });
  assert.equal(passport.pcxItemId, "PCX-1");
  assert.equal(Object.hasOwn(passport, "serial"), false);
  assert.equal(Object.hasOwn(passport, "acquisitionCost"), false);
  assert.equal(Object.hasOwn(passport, "technicianNotes"), false);
  assert.deepEqual(passport.specifications, []);
});
