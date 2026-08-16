import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPrimarySerialIdentifier,
  createInventoryItem,
  createSerialIdentifier,
  InventoryItemStatus,
  normalizeSerialIdentifier,
  SerialIdentifierType
} from "../src/index.mjs";

test("inventory item is a server-owned RECEIVED record tied to a product model", () => {
  const record = createInventoryItem({ id: "inv-1", productModelId: "model-1", receivedAt: "2026-08-16T00:00:00.000Z" });
  assert.equal(record.status, InventoryItemStatus.RECEIVED);
  assert.equal(record.productModelId, "model-1");
  assert.equal(record.acquisitionId, null);
  assert.equal(record.pcxItemId, null);
  assert.throws(() => createInventoryItem({ id: "inv", productModelId: "model", status: "SOLD" }), /status/);
});

test("serial identifiers are normalized and require one primary", () => {
  const identifier = createSerialIdentifier({ id: "s1", inventoryItemId: "inv-1", identifierType: SerialIdentifierType.SERIAL, value: " abc-123 ", isPrimary: true });
  assert.equal(identifier.valueNormalized, "ABC-123");
  assert.equal(identifier.valueDisplay, "abc-123");
  assert.throws(() => createSerialIdentifier({ id: "s", inventoryItemId: "i", identifierType: "BOGUS", value: "x" }), /type/);
  assert.throws(() => assertPrimarySerialIdentifier([]), /at least one/);
  assert.throws(() => assertPrimarySerialIdentifier([{ identifierType: "SERIAL", valueNormalized: "A", isPrimary: false }]), /primary/);

  const valid = assertPrimarySerialIdentifier([
    createSerialIdentifier({ id: "s1", inventoryItemId: "i", identifierType: SerialIdentifierType.SERIAL, value: "A", isPrimary: true }),
    createSerialIdentifier({ id: "s2", inventoryItemId: "i", identifierType: SerialIdentifierType.IMEI, value: "B" })
  ]);
  assert.equal(valid.length, 2);

  assert.throws(
    () => assertPrimarySerialIdentifier([
      createSerialIdentifier({ id: "s1", inventoryItemId: "i", identifierType: SerialIdentifierType.SERIAL, value: "A", isPrimary: true }),
      createSerialIdentifier({ id: "s2", inventoryItemId: "i", identifierType: SerialIdentifierType.SERIAL, value: "a", isPrimary: true })
    ]),
    /duplicate/
  );
});

test("normalizeSerialIdentifier rejects empty and overlong values", () => {
  assert.equal(normalizeSerialIdentifier(" serial "), "SERIAL");
  assert.throws(() => normalizeSerialIdentifier(""), /required/);
  assert.throws(() => normalizeSerialIdentifier("x".repeat(129)), /too long/);
});
