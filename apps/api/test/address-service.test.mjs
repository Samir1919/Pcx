import assert from "node:assert/strict";
import test from "node:test";
import { AddressError, createAddressService } from "../src/modules/identity/address-service.mjs";

const existing = { id: "a1", label: "Home", recipientName: "Buyer", phone: "017", addressLine1: "Road", addressLine2: null, area: "Area", city: "Dhaka", postalCode: null, isDefault: true, createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z" };

function fixture(overrides = {}) {
  const calls = [];
  const repository = {
    async findByOwner(userId, addressId) { calls.push(["find", userId, addressId]); return existing; },
    async listByOwner(userId) { calls.push(["list", userId]); return [existing]; },
    async create(value) { calls.push(["create", value]); return { status: "created", address: existing }; },
    async update(...value) { calls.push(["update", ...value]); return { ...existing, ...value[2] }; },
    async delete(...value) { calls.push(["delete", ...value]); return true; },
    ...overrides
  };
  const service = createAddressService({ authService: { async authenticateAccess() { return { userId: "owner", status: "ACTIVE", roles: ["CUSTOMER"] }; } }, repository, id: () => "server-id", clock: () => new Date("2026-08-16T01:00:00.000Z") });
  return { service, calls };
}

test("address operations derive owner from authenticated access", async () => {
  const { service, calls } = fixture();
  await service.list("access");
  await service.create("access", { label: "Home", recipientName: "Buyer", phone: "017", addressLine1: "Road", addressLine2: null, area: "Area", city: "Dhaka", postalCode: null, isDefault: true });
  await service.update("access", "a1", { label: "Office" });
  await service.delete("access", "a1");
  assert.deepEqual(calls[0], ["list", "owner"]);
  assert.equal(calls.find(([name]) => name === "create")[1].userId, "owner");
  assert.equal(calls.find(([name]) => name === "create")[1].id, "server-id");
  assert.equal(calls.find(([name]) => name === "update")[1], "owner");
  assert.equal(calls.find(([name]) => name === "delete")[1], "owner");
});

test("address service rejects mass assignment, invalid fields, and inaccessible records", async () => {
  const { service } = fixture({ async findByOwner() { return null; }, async delete() { return false; } });
  await assert.rejects(service.create("access", { ...existing, role: "ADMIN" }), (error) => error instanceof AddressError && error.code === "invalid_input");
  await assert.rejects(service.update("access", "other", { label: "x" }), (error) => error.code === "not_found");
  await assert.rejects(service.delete("access", "other"), (error) => error.code === "not_found");
});
