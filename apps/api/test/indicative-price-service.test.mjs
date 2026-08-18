import assert from "node:assert/strict";
import test from "node:test";
import { createIndicativePriceService, IndicativePriceError } from "../src/modules/pricing/indicative-price-service.mjs";

function fixture(overrides = {}) {
  const calls = { upserted: [], listed: [], model: [], category: [] };
  const repository = {
    async upsertActive(record) { calls.upserted.push(record); return record; },
    async findActiveByProductModel(id) { calls.model.push(id); return null; },
    async findActiveByCategory(id) { calls.category.push(id); return null; },
    async list() { calls.listed.push(true); return []; },
    ...overrides.repository
  };
  const service = createIndicativePriceService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; }, ...overrides.authService },
    repository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T00:00:00.000Z")
  });
  return { service, calls };
}

test("set validates permission, input shape, and money", async () => {
  const { service, calls } = fixture();
  const result = await service.set("access", { productModelId: "m1", lowValue: 1000, highValue: 2000 });
  assert.equal(result.id, "id-1");
  assert.equal(calls.upserted[0].setBy, "admin-1");
  assert.equal(calls.upserted[0].productModelId, "m1");

  await assert.rejects(
    service.set("access", { productModelId: "m1", lowValue: 2000, highValue: 1000 }),
    (error) => error instanceof IndicativePriceError && error.code === "invalid_input"
  );
  await assert.rejects(
    service.set("access", { productModelId: "m1", lowValue: 1000, highValue: 2000, status: "ACTIVE" }),
    (error) => error instanceof IndicativePriceError && error.code === "invalid_input"
  );
});

test("set requires PRICING_MANAGE permission", async () => {
  const { service } = fixture({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } }
  });
  await assert.rejects(
    service.set("access", { categoryId: "c1", lowValue: 100, highValue: 200 }),
    (error) => error instanceof IndicativePriceError && error.code === "forbidden"
  );
});

test("quote resolves model over category with safe public projection", async () => {
  const modelPrice = { productModelId: "m1", categoryId: null, lowValue: 1500, highValue: 2500 };
  const categoryPrice = { productModelId: null, categoryId: "c1", lowValue: 500, highValue: 900 };
  const { service } = fixture({
    repository: {
      async findActiveByProductModel() { return modelPrice; },
      async findActiveByCategory() { return categoryPrice; },
      async upsertActive() { return null; },
      async list() { return []; }
    }
  });
  const quote = await service.quote({ productModelId: "m1", categoryId: "c1" });
  assert.equal(quote.data.range.lowValue, 1500);
  assert.equal(quote.data.range.highValue, 2500);
  assert.equal("setBy" in quote.data.range, false);
  assert.match(quote.data.range.disclaimer, /not a final offer/i);
});

test("quote returns null range when no price exists", async () => {
  const { service } = fixture();
  const quote = await service.quote({ categoryId: "unknown" });
  assert.equal(quote.data.range, null);
});
