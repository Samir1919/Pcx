import assert from "node:assert/strict";
import test from "node:test";
import { convertReservation, createReservation, isExpiredReservation, ReservationStatus } from "../src/index.mjs";

test("reservation is ACTIVE with a bounded window and can be converted once", () => {
  const reservation = createReservation({
    id: "r1",
    inventoryItemId: "inv-1",
    reservedByUserId: "u1",
    reservedUntil: "2026-08-16T12:15:00.000Z",
    createdAt: "2026-08-16T12:00:00.000Z"
  });
  assert.equal(reservation.status, ReservationStatus.ACTIVE);
  assert.throws(() => createReservation({ id: "r", inventoryItemId: "i", reservedByUserId: "u", reservedUntil: "2026-08-16T12:00:00.000Z", createdAt: "2026-08-16T12:00:00.000Z" }), /after/);

  const converted = convertReservation(reservation, { convertedAt: "2026-08-16T12:10:00.000Z" });
  assert.equal(converted.status, ReservationStatus.CONVERTED);
  assert.throws(() => convertReservation(converted), /ACTIVE/);
});

test("expiry detection only applies to ACTIVE reservations past their window", () => {
  const active = createReservation({ id: "r", inventoryItemId: "i", reservedByUserId: "u", reservedUntil: "2026-08-16T12:15:00.000Z", createdAt: "2026-08-16T12:00:00.000Z" });
  assert.equal(isExpiredReservation(active, new Date("2026-08-16T12:20:00.000Z")), true);
  assert.equal(isExpiredReservation(active, new Date("2026-08-16T12:10:00.000Z")), false);
  assert.equal(isExpiredReservation({ status: "CONVERTED", reservedUntil: "2026-08-16T11:00:00.000Z" }), false);
});
