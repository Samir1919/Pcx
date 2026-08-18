import assert from "node:assert/strict";
import test from "node:test";
import { archiveIndicativePrice, createIndicativePrice, IndicativePriceStatus, toPublicQuoteRange } from "../src/index.mjs";

test("createIndicativePrice targets exactly one scope and validates money", () => {
  const model = createIndicativePrice({ id: "p1", productModelId: "m1", lowValue: 1000, highValue: 2000, setBy: "admin-1", createdAt: "2026-08-16T00:00:00.000Z" });
  assert.equal(model.productModelId, "m1");
  assert.equal(model.categoryId, null);
  assert.equal(model.status, IndicativePriceStatus.ACTIVE);

  const category = createIndicativePrice({ id: "p2", categoryId: "c1", lowValue: 500, highValue: 900, setBy: "admin-1" });
  assert.equal(category.categoryId, "c1");
  assert.equal(category.productModelId, null);

  assert.throws(() => createIndicativePrice({ id: "p3", lowValue: 100, highValue: 200, setBy: "a" }), /exactly one/);
  assert.throws(() => createIndicativePrice({ id: "p4", productModelId: "m1", categoryId: "c1", lowValue: 100, highValue: 200, setBy: "a" }), /exactly one/);
  assert.throws(() => createIndicativePrice({ id: "p5", productModelId: "m1", lowValue: 300, highValue: 200, setBy: "a" }), /low/);
  assert.throws(() => createIndicativePrice({ id: "p6", productModelId: "m1", lowValue: 0, highValue: 200, setBy: "a" }), /positive/);
});

test("archiveIndicativePrice appends status change without mutating active record", () => {
  const active = createIndicativePrice({ id: "p1", productModelId: "m1", lowValue: 1000, highValue: 2000, setBy: "a" });
  const archived = archiveIndicativePrice(active, { archivedAt: "2026-08-17T00:00:00.000Z" });
  assert.equal(active.status, IndicativePriceStatus.ACTIVE);
  assert.equal(archived.status, IndicativePriceStatus.ARCHIVED);
  assert.equal(archived.archivedAt, "2026-08-17T00:00:00.000Z");
  assert.equal(archiveIndicativePrice(archived), archived);
});

test("toPublicQuoteRange exposes only safe estimated range with disclaimer", () => {
  const price = createIndicativePrice({ id: "p1", productModelId: "m1", lowValue: 1200, highValue: 3000, setBy: "a" });
  const quote = toPublicQuoteRange(price);
  assert.deepEqual(quote, {
    lowValue: 1200,
    highValue: 3000,
    productModelId: "m1",
    categoryId: null,
    basis: "indicative-range",
    disclaimer: "Estimated market range, not a final offer. The final offer is determined only after physical inspection."
  });
  assert.equal("setBy" in quote, false);
  assert.equal(toPublicQuoteRange(null), null);
});
