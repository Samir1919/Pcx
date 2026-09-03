import assert from "node:assert/strict";
import test from "node:test";
import { createSellEntryConfig, parseSellEntryIcon, parseSellEntryKey, sellEntryKeyFromSlug, SellEntryKind } from "../src/index.mjs";

test("sellEntryKeyFromSlug derives a canonical key from a category slug", () => {
  assert.equal(sellEntryKeyFromSlug("desktop-pc"), "DESKTOP_PC");
  assert.equal(sellEntryKeyFromSlug("pc-parts"), "PC_PARTS");
  assert.equal(sellEntryKeyFromSlug("monitors"), "MONITORS");
  assert.equal(sellEntryKeyFromSlug("laptop-parts"), "LAPTOP_PARTS");
  assert.throws(() => sellEntryKeyFromSlug(""), /slug/);
  assert.throws(() => sellEntryKeyFromSlug("9phones"), /entryKey/);
});

test("parseSellEntryKey accepts canonical keys only", () => {
  assert.equal(parseSellEntryKey("DESKTOP_PC"), "DESKTOP_PC");
  assert.equal(parseSellEntryKey("MONITORS"), "MONITORS");
  assert.throws(() => parseSellEntryKey("desktop_pc"), /entryKey/);
  assert.throws(() => parseSellEntryKey("DESKTOP-PC"), /entryKey/);
});

test("parseSellEntryIcon accepts canonical lowercase slugs", () => {
  assert.equal(parseSellEntryIcon("desktop"), "desktop");
  assert.equal(parseSellEntryIcon("laptop-parts"), "laptop-parts");
  assert.equal(parseSellEntryIcon("monitor"), "monitor");
  assert.throws(() => parseSellEntryIcon("Desktop"), /iconKey/);
  assert.throws(() => parseSellEntryIcon("raw emoji"), /iconKey/);
});

test("createSellEntryConfig validates the whole record", () => {
  const record = createSellEntryConfig({ id: "e1", entryKey: "MONITORS", categoryId: "c1", kind: SellEntryKind.PARTS, iconKey: "monitor", hint: "Sell a monitor", sortOrder: 50, isActive: true });
  assert.equal(record.entryKey, "MONITORS");
  assert.equal(record.kind, "PARTS");
  assert.equal(record.isActive, true);
  assert.throws(() => createSellEntryConfig({ id: "e1", entryKey: "monitors", categoryId: "c1", kind: "PARTS", iconKey: "monitor", hint: "x" }), /entryKey/);
});
