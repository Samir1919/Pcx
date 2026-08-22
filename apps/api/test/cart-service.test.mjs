import assert from "node:assert/strict";
import test from "node:test";
import { createCartService } from "../src/modules/commerce/cart-service.mjs";

function fixture(overrides = {}) {
  const listingRepository = {
    async findPublishedByInventoryItem(id) {
      return id === "inv-1" ? { id: "l1", inventoryItemId: "inv-1", price: 1500 } : null;
    },
    ...overrides.listingRepository
  };
  const cartRepository = {
    async findActiveByUser() { return null; },
    async createCart(record) { return record; },
    async addItem(record) { return record; },
    async listItems() { return []; },
    async removeItem() { return true; },
    ...overrides.cartRepository
  };
  const service = createCartService({
    authService: { async authenticateAccess() { return { userId: "c1", status: "ACTIVE", roles: ["CUSTOMER"] }; }, ...overrides.authService },
    listingRepository,
    cartRepository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z")
  });
  return { service, cartRepository };
}

test("cart add derives server-owned price snapshot from the published listing", async () => {
  let captured;
  const { service } = fixture({
    cartRepository: {
      async findActiveByUser() { return { id: "cart-1", userId: "c1", status: "ACTIVE" }; },
      async addItem(record) { captured = record; return record; }
    }
  });
  const item = await service.add("access", { inventoryItemId: "inv-1" });
  assert.equal(captured.priceSnapshot, 1500);
  assert.equal(item.priceSnapshot, 1500);
});

test("cart add rejects unknown listing and client-supplied price", async () => {
  const { service } = fixture();
  await assert.rejects(service.add("access", { inventoryItemId: "missing" }), (e) => e.code === "not_found");
  await assert.rejects(service.add("access", { inventoryItemId: "inv-1", priceSnapshot: 1 }), (e) => e.code === "invalid_input");
});

test("cart get and add require customer", async () => {
  const { service } = fixture();
  const empty = await service.get("access");
  assert.equal(empty.cart, null);
  assert.deepEqual(empty.items, []);

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "a", status: "ACTIVE", roles: ["ADMIN"] }; } } });
  await assert.rejects(denied.service.add("access", { inventoryItemId: "inv-1" }), (e) => e.code === "forbidden");
});
