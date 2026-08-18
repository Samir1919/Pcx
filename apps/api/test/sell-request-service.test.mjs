import assert from "node:assert/strict";
import test from "node:test";
import { createSellRequestService, SellRequestError } from "../src/modules/acquisition/sell-request-service.mjs";
import { FulfilmentPreference, SellRequestStatus } from "../../../packages/domain/src/index.mjs";

function fixture(overrides = {}) {
  const calls = { created: [], submitted: [], listed: [], found: [] };
  const repository = {
    async create(request, declaration, now) {
      calls.created.push({ request, declaration, now });
      return { ...request, declaration };
    },
    async submit(userId, requestId, now) {
      calls.submitted.push({ userId, requestId, now });
      return { status: "submitted", record: { id: requestId, userId, status: SellRequestStatus.SUBMITTED } };
    },
    async findByOwner(userId, requestId) {
      calls.found.push({ userId, requestId });
      return requestId === "existing" ? { id: requestId, userId, status: SellRequestStatus.DRAFT } : null;
    },
    async listByOwner(userId) {
      calls.listed.push(userId);
      return [{ id: "sr", userId, status: SellRequestStatus.DRAFT }];
    },
    async listAll() { return []; },
    ...overrides.repository
  };
  const service = createSellRequestService({
    authService: { async authenticateAccess() { return { userId: "owner-1", status: "ACTIVE", roles: ["CUSTOMER"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("create derives owner, normalizes contact, and owns status", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", {
    categoryId: "gpu",
    contactName: "Seller",
    contactPhone: "01700000000",
    contactEmail: " SELLER@EXAMPLE.COM ",
    fulfilmentPreference: FulfilmentPreference.COURIER,
    ownershipDeclared: true
  });
  assert.equal(result.userId, "owner-1");
  assert.equal(result.status, SellRequestStatus.DRAFT);
  assert.equal(result.contactEmail, "seller@example.com");
  assert.equal(calls.created[0].request.userId, "owner-1");
  assert.equal(calls.created[0].declaration.ownershipDeclared, true);
});

test("create rejects unknown fields, invalid preference, and mass assignment", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.create("access", { categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: "EXPRESS" }),
    (error) => error instanceof SellRequestError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.create("access", { categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: FulfilmentPreference.PICKUP, status: "SUBMITTED" }),
    (error) => error instanceof SellRequestError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.create("access", { categoryId: "gpu", contactName: "N", contactPhone: "0", fulfilmentPreference: FulfilmentPreference.PICKUP, ownershipDeclared: false }),
    (error) => error instanceof SellRequestError && error.code === "invalid_input"
  );
});

test("create captures seller-declared selected specs", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", {
    categoryId: "gpu",
    contactName: "Seller",
    contactPhone: "01700000000",
    fulfilmentPreference: FulfilmentPreference.COURIER,
    ownershipDeclared: true,
    selectedSpecs: [{ key: "vram_gb", value: 12 }, { key: "condition", value: "good" }]
  });
  assert.deepEqual(result.selectedSpecs, [{ key: "vram_gb", value: 12 }, { key: "condition", value: "good" }]);
  assert.deepEqual(calls.created[0].request.selectedSpecs, [{ key: "vram_gb", value: 12 }, { key: "condition", value: "good" }]);
});

test("create rejects non-scalar selected spec values", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.create("access", {
      categoryId: "gpu",
      contactName: "Seller",
      contactPhone: "01700000000",
      fulfilmentPreference: FulfilmentPreference.COURIER,
      ownershipDeclared: true,
      selectedSpecs: [{ key: "vram_gb", value: { nested: true } }]
    }),
    (error) => error instanceof SellRequestError && error.code === "invalid_input"
  );
});

test("get and submit enforce ownership and DRAFT-only transition", async () => {
  const { service } = fixture();
  assert.deepEqual((await service.get("access", "existing")).id, "existing");
  await assert.rejects(service.get("access", "missing"), (error) => error.code === "not_found");
  const submitted = await service.submit("access", "existing");
  assert.equal(submitted.status, SellRequestStatus.SUBMITTED);

  const doubleSubmit = fixture({
    repository: {
      async findByOwner() { return { id: "x", userId: "owner-1", status: SellRequestStatus.SUBMITTED }; }
    }
  });
  await assert.rejects(doubleSubmit.service.submit("access", "x"), (error) => error.code === "invalid_state");
});
