import assert from "node:assert/strict";
import test from "node:test";
import { BuildComponentRole, createBuildComponent, parseSellEntry, SellEntry, validateBuildComponents } from "../src/index.mjs";

test("parseSellEntry accepts canonical UPPER_SNAKE_CASE keys and rejects malformed values", () => {
  assert.equal(parseSellEntry("DESKTOP_PC"), SellEntry.DESKTOP_PC);
  assert.equal(parseSellEntry("PC_PARTS"), SellEntry.PC_PARTS);
  assert.equal(parseSellEntry("LAPTOP"), SellEntry.LAPTOP);
  assert.equal(parseSellEntry("LAPTOP_PARTS"), SellEntry.LAPTOP_PARTS);
  // Runtime-promoted categories (e.g. a "Monitors" sell entry) are valid too.
  assert.equal(parseSellEntry("MONITORS"), "MONITORS");
  assert.equal(parseSellEntry(null), null);
  assert.equal(parseSellEntry(""), null);
  assert.throws(() => parseSellEntry("trade_in"), /sellEntry/);
  assert.throws(() => parseSellEntry("2FA"), /sellEntry/);
  assert.throws(() => parseSellEntry("TRADE IN"), /sellEntry/);
});

test("createBuildComponent validates role and requires a product model id", () => {
  assert.deepEqual(createBuildComponent({ role: "cpu", productModelId: "cpu-model" }), { role: BuildComponentRole.CPU, productModelId: "cpu-model" });
  assert.throws(() => createBuildComponent({ role: "fan", productModelId: "x" }), /role/);
  assert.throws(() => createBuildComponent({ role: "cpu", productModelId: "" }), /productModelId/);
});

test("validateBuildComponents rejects duplicates and non-array input", () => {
  const components = validateBuildComponents([
    { role: "cpu", productModelId: "cpu-model" },
    { role: "ram", productModelId: "ram-model" }
  ]);
  assert.equal(components.length, 2);
  assert.throws(() => validateBuildComponents([
    { role: "cpu", productModelId: "cpu-model" },
    { role: "cpu", productModelId: "cpu-model-2" }
  ]), /unique/);
  assert.throws(() => validateBuildComponents({ role: "cpu" }), /array/);
  assert.deepEqual(validateBuildComponents(null), []);
  assert.deepEqual(validateBuildComponents(undefined), []);
});
