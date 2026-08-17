import assert from "node:assert/strict";
import test from "node:test";
import { createReservationService, ReservationError } from "../src/modules/commerce/reservation-service.mjs";

function fixture(overrides = {}) {
  const calls = { creates: [], converts: [], actives: [] };
  const listingRepository = {
    async findPublishedByInventoryItem(id) { return id === "inv-1" ? { id: "l1", inventoryItemId: "inv-1" } : null; },
    ...overrides.listingRepository
  };
  const reservationRepository = {
    async create(record) { calls.creates.push(record); return record; },
    async convert(id, now) { calls.converts.push({ id, now }); return { status: "converted", record: { id, status: "CONVERTED" } }; },
    async findById() { return { id: "r1", status: "ACTIVE", reservedUntil: "2026-08-16T12:15:00.000Z" }; },
    async findActiveByItem() { return null; },
    ...overrides.reservationRepository
  };
  const service = createReservationService({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; }, ...overrides.authService },
    listingRepository,
    reservationRepository,
    id: (() => { let n = 0; return () => `id-${++n}`; })(),
    clock: () => new Date("2026-08-16T12:00:00.000Z"),
    ...(overrides.reservationWindowMs != null ? { reservationWindowMs: overrides.reservationWindowMs } : {})
  });
  return { service, calls };
}

test("reservation create derives reservedUntil server-side and rejects client expiry", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", { inventoryItemId: "inv-1" });
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.reservedByUserId, "customer-1");
  assert.equal(calls.creates.length, 1);
  // Server derives expiry from the fixed clock + default 15-minute window,
  // never from client input.
  assert.equal(result.reservedUntil, "2026-08-16T12:15:00.000Z");

  // A user-supplied reservedUntil is not an accepted input field.
  await assert.rejects(
    service.create("access", { inventoryItemId: "inv-1", reservedUntil: "2999-01-01T00:00:00.000Z" }),
    (error) => error.code === "invalid_input"
  );

  // A custom reservation window changes the derived expiry proportionally.
  const short = fixture({ reservationWindowMs: 5 * 60 * 1000 });
  const shortResult = await short.service.create("access", { inventoryItemId: "inv-1" });
  assert.equal(shortResult.reservedUntil, "2026-08-16T12:05:00.000Z");
});

test("reservation create requires customer and published listing, mapping 23505 to unavailable", async () => {
  const { service, calls } = fixture();
  const result = await service.create("access", { inventoryItemId: "inv-1" });
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.reservedByUserId, "customer-1");
  assert.equal(calls.creates.length, 1);

  await assert.rejects(service.create("access", { inventoryItemId: "missing" }), (error) => error.code === "not_found");

  const conflict = fixture({ reservationRepository: { async create() { const e = new Error("dup"); e.code = "23505"; throw e; } } });
  await assert.rejects(conflict.service.create("access", { inventoryItemId: "inv-1" }), (error) => error.code === "item_unavailable");

  const denied = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "ACTIVE", roles: ["CUSTOMER"], }; } } });
  // non-active customer is not allowed here since we only stub ACTIVE; use inactive
  const inactive = fixture({ authService: { async authenticateAccess() { return { userId: "u", status: "SUSPENDED", roles: ["CUSTOMER"] }; } } });
  await assert.rejects(inactive.service.create("access", { inventoryItemId: "inv-1" }), (error) => error.code === "forbidden");
});

test("reservation convert enforces ACTIVE state and expiry", async () => {
  const { service, calls } = fixture();
  const converted = await service.convert("access", "r1");
  assert.equal(converted.status, "CONVERTED");
  assert.equal(calls.converts.length, 1);

  const notFound = fixture({ reservationRepository: { async findById() { return null; } } });
  await assert.rejects(notFound.service.convert("access", "r1"), (error) => error.code === "not_found");

  const expired = fixture({ reservationRepository: { async findById() { return { id: "r1", status: "ACTIVE", reservedUntil: "2026-08-16T11:00:00.000Z" }; } } });
  await assert.rejects(expired.service.convert("access", "r1"), (error) => error.code === "invalid_state");
});
