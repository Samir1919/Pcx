import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryService, InventoryError } from "../src/modules/inventory/inventory-service.mjs";
import { InventoryItemStatus, SerialIdentifierType } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { intakes: [], lists: [], finds: [] };
  const repository = {
    async createWithIdentifiers(record, identifiers, now) { calls.intakes.push({ record, identifiers, now }); return { item: record, identifiers }; },
    async list() { calls.lists.push(); return [{ id: "inv-1" }]; },
    async findById(id) { calls.finds.push(id); return id === "inv-1" ? { id, status: InventoryItemStatus.RECEIVED } : null; },
    ...overrides.repository
  };
  const service = createInventoryService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("intake creates RECEIVED item with server-derived PCX ID and normalized primary serial", async () => {
  const { service, calls } = fixture();
  const result = await service.intake("access", {
    productModelId: "model-1",
    identifiers: [{ identifierType: SerialIdentifierType.SERIAL, value: " SN-123 ", isPrimary: true }]
  });
  assert.equal(result.item.status, InventoryItemStatus.RECEIVED);
  // PCX ID is always server-derived and never client-authoritative.
  assert.match(result.item.pcxItemId, /^PCX-[0-9A-F]{8}$/);
  assert.equal(result.identifiers[0].valueNormalized, "SN-123");
  assert.equal(calls.intakes.length, 1);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(denied.service.intake("access", { productModelId: "model", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: true }] }), (error) => error.code === "forbidden");
});

test("intake rejects client-supplied pcxItemId", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.intake("access", { productModelId: "model", pcxItemId: "PCX-MINE", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: true }] }),
    (error) => error.code === "invalid_input"
  );
});

test("intake rejects missing primary, extra fields, and duplicate identifier constraint", async () => {
  const { service } = fixture();
  await assert.rejects(service.intake("access", { productModelId: "model", identifiers: [] }), (error) => error.code === "invalid_input");
  await assert.rejects(service.intake("access", { productModelId: "model", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: false }] }), (error) => error.code === "invalid_input");
  await assert.rejects(service.intake("access", { productModelId: "model", status: "LISTED", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: true }] }), (error) => error.code === "invalid_input");

  const duplicate = fixture({ repository: { async createWithIdentifiers() { const e = new Error("dup"); e.code = "23505"; throw e; } } });
  await assert.rejects(duplicate.service.intake("access", { productModelId: "model", identifiers: [{ identifierType: "SERIAL", value: "x", isPrimary: true }] }), (error) => error.code === "duplicate_identifier");
});

test("list and get enforce permission and return found record", async () => {
  const { service } = fixture();
  assert.equal((await service.get("access", "inv-1")).id, "inv-1");
  await assert.rejects(service.get("access", "missing"), (error) => error.code === "not_found");
  assert.equal((await service.list("access")).length, 1);
});
