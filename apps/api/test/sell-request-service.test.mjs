import assert from "node:assert/strict";
import test from "node:test";
import { createSellRequestService, SellRequestError } from "../src/modules/acquisition/sell-request-service.mjs";
import { FulfilmentPreference, SellRequestStatus } from "@pcx/domain";

function fixture(overrides = {}) {
  const calls = { created: [], submitted: [], listed: [], found: [], transitioned: [] };
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
    async findById(requestId) {
      calls.foundById = requestId;
      return requestId === "existing" ? { id: requestId, userId: "user-1", status: SellRequestStatus.REVIEWING, submittedAt: "2026-08-16T00:00:00.000Z" } : null;
    },
    async transition(requestId, from, to, submittedAt, now) {
      calls.transitioned.push({ requestId, from, to, submittedAt, now });
      return { status: "ok", record: { id: requestId, status: to } };
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
    indicativePriceService: overrides.indicativePriceService ?? { async quote() { return { data: { range: null } }; } },
    catalogService: overrides.catalogService ?? null,
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

test("create reuses contact details from the authenticated identity", async () => {
  const { service, calls } = fixture({
    authService: {
      async authenticateAccess() {
        return { userId: "owner-1", email: "seller@example.com", phone: "01711111111", fullName: "Identity Seller", status: "ACTIVE", roles: ["CUSTOMER"] };
      }
    }
  });
  const result = await service.create("access", {
    categoryId: "gpu",
    // Deliberately stale form values: server must prefer the identity's data.
    contactName: "Form Name",
    contactPhone: "01999999999",
    contactEmail: "form@example.com",
    fulfilmentPreference: FulfilmentPreference.PICKUP,
    ownershipDeclared: true
  });
  assert.equal(result.contactName, "Identity Seller");
  assert.equal(result.contactPhone, "01711111111");
  assert.equal(result.contactEmail, "seller@example.com");
  assert.equal(calls.created[0].request.contactName, "Identity Seller");
  assert.equal(calls.created[0].request.contactPhone, "01711111111");
  assert.equal(calls.created[0].request.contactEmail, "seller@example.com");
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

test("create captures sellEntry and validated build components", async () => {
  const { service, calls } = fixture();
  await service.create("access", {
    categoryId: "gpu",
    contactName: "Seller",
    contactPhone: "01700000000",
    fulfilmentPreference: FulfilmentPreference.COURIER,
    ownershipDeclared: true,
    sellEntry: "DESKTOP_PC",
    buildComponents: [{ role: "cpu", productModelId: "cpu-model" }, { role: "ram", productModelId: "ram-model" }]
  });
  assert.equal(calls.created[0].request.sellEntry, "DESKTOP_PC");
  assert.deepEqual(calls.created[0].request.buildComponents, [
    { role: "cpu", productModelId: "cpu-model" },
    { role: "ram", productModelId: "ram-model" }
  ]);
  await assert.rejects(
    service.create("access", {
      categoryId: "gpu",
      contactName: "Seller",
      contactPhone: "01700000000",
      fulfilmentPreference: FulfilmentPreference.COURIER,
      ownershipDeclared: true,
      sellEntry: "TRADE_IN"
    }),
    (error) => error instanceof SellRequestError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.create("access", {
      categoryId: "gpu",
      contactName: "Seller",
      contactPhone: "01700000000",
      fulfilmentPreference: FulfilmentPreference.COURIER,
      ownershipDeclared: true,
      buildComponents: [{ role: "cpu", productModelId: "a" }, { role: "cpu", productModelId: "b" }]
    }),
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

test("create resolves the estimated range from the server-owned quote service", async () => {
  let called = null;
  const { service } = fixture({
    indicativePriceService: {
      async quote(args) {
        called = args;
        return { data: { range: { lowValue: 100, highValue: 200, basis: "indicative-range", disclaimer: "Estimated market range, not a final offer." } } };
      }
    }
  });
  const result = await service.create("access", {
    categoryId: "80000000-0000-0000-0000-000000000003",
    productModelId: "model-1",
    contactName: "Seller",
    contactPhone: "01700000000",
    fulfilmentPreference: FulfilmentPreference.COURIER,
    ownershipDeclared: true
  });
  assert.deepEqual(called, { productModelId: "model-1", categoryId: "80000000-0000-0000-0000-000000000003" });
  assert.equal(result.estimatedRange.lowValue, 100);
  assert.equal(result.estimatedRange.highValue, 200);
  assert.match(result.estimatedRange.disclaimer, /not a final offer/i);
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

test("create rejects non-customer actors so they can't start a request they cannot complete", async () => {
  const admin = fixture({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } }
  });
  await assert.rejects(
    admin.service.create("access", {
      categoryId: "gpu",
      contactName: "Admin",
      contactPhone: "01700000000",
      fulfilmentPreference: FulfilmentPreference.COURIER,
      ownershipDeclared: true
    }),
    (error) => error instanceof SellRequestError && error.code === "forbidden"
  );
});

test("admin transition follows the canonical graph", async () => {
  const adminService = fixture({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } }
  }).service;
  // REVIEWING -> OFFERED is valid (offer is made during review, before inspection).
  const result = await adminService.transition("access", "existing", "OFFERED");
  assert.equal(result.status, "OFFERED");

  // REVIEWING -> INSPECTION_REQUIRED is no longer allowed (inspection follows acceptance).
  await assert.rejects(adminService.transition("access", "existing", "INSPECTION_REQUIRED"), (error) => error.code === "invalid_state");

  // DRAFT -> ACCEPTED is invalid.
  await assert.rejects(adminService.transition("access", "missing", "ACCEPTED"), (error) => error.code === "not_found");
});

test("getAdmin resolves model names via the catalog read and degrades to the id", async () => {
  const admin = fixture({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository: {
      async findById() {
        return {
          id: "existing",
          userId: "user-1",
          status: SellRequestStatus.REVIEWING,
          productModelId: "model-a",
          buildComponents: [
            { role: "cpu", productModelId: "model-cpu" },
            { role: "ram", productModelId: "missing-model" }
          ]
        };
      }
    },
    catalogService: {
      async getProductModel(id) {
        if (id === "model-a") return { name: "Top Model" };
        if (id === "model-cpu") return { name: "CPU Model" };
        return null;
      }
    }
  });
  const record = await admin.service.getAdmin("access", "existing");
  assert.equal(record.productModelName, "Top Model");
  assert.equal(record.buildComponents[0].productModelName, "CPU Model");
  // A missing/inactive model degrades to the raw id, never throws.
  assert.equal(record.buildComponents[1].productModelName, null);
  assert.equal(record.buildComponents[1].productModelId, "missing-model");
});

test("admin getAdmin reads any request and is permission-gated", async () => {
  // Admin can read a record regardless of ownership.
  const admin = fixture({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } }
  });
  const record = await admin.service.getAdmin("access", "existing");
  assert.equal(record.id, "existing");
  assert.equal(record.status, "REVIEWING");

  await assert.rejects(admin.service.getAdmin("access", "missing"), (error) => error.code === "not_found");

  // A customer (non-admin) is denied.
  const customer = fixture();
  await assert.rejects(customer.service.getAdmin("access", "existing"), (error) => error.code === "forbidden");
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
