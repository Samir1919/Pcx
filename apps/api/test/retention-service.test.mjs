import assert from "node:assert/strict";
import test from "node:test";
import { createRetentionService } from "../src/modules/reporting/retention-service.mjs";

test("retention run deletes each safe category with its configured window", async () => {
  const calls = [];
  const repository = {
    async deleteClosedReservations(cutoff) { calls.push(["reservations", cutoff]); return 3; },
    async deleteDeliveredNotifications(cutoff) { calls.push(["notifications", cutoff]); return 5; },
    async deleteExpiredSessions(cutoff) { calls.push(["sessions", cutoff]); return 2; },
    async deleteClosedOffers(cutoff) { calls.push(["offers", cutoff]); return 1; }
  };
  const service = createRetentionService({ repository, clock: () => new Date("2026-09-01T00:00:00.000Z") });
  const result = await service.run({ now: new Date("2026-09-01T00:00:00.000Z") });
  assert.deepEqual(result.deleted, { reservations: 3, notifications: 5, sessions: 2, offers: 1 });
  assert.deepEqual(result.errors, []);
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], "reservations");
  assert.equal(calls[1][1], new Date("2026-08-25T00:00:00.000Z").toISOString()); // notifications 7 days
  assert.equal(calls[0][1], new Date("2026-08-02T00:00:00.000Z").toISOString()); // reservations 30 days
});

test("retention run collects per-category failures without halting the pass", async () => {
  const repository = {
    async deleteClosedReservations() { return 1; },
    async deleteDeliveredNotifications() { throw new Error("notifications table locked"); },
    async deleteExpiredSessions() { return 2; },
    async deleteClosedOffers() { throw new Error("offers blocked"); }
  };
  const service = createRetentionService({ repository, clock: () => new Date("2026-09-01T00:00:00.000Z") });
  const result = await service.run({ now: new Date("2026-09-01T00:00:00.000Z") });
  assert.equal(result.deleted.reservations, 1);
  assert.equal(result.deleted.notifications, 0);
  assert.equal(result.deleted.sessions, 2);
  assert.equal(result.deleted.offers, 0);
  assert.deepEqual(result.errors.map((e) => e.category).sort(), ["notifications", "offers"]);
});