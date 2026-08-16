# Agent Handoff: E9 Cart, Reservation & Checkout (Double-Sell Protection)

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

The core double-sell guard is in place: a bounded reservation with a database-enforced one-active-per-item constraint. A second ACTIVE reservation for the same physical item raises a unique violation mapped to 409 `ITEM_UNAVAILABLE`; conversion releases the guard so a later reservation can succeed.

## Changed areas

- `packages/domain/src/commerce/reservation.mjs`: ACTIVE→CONVERTED lifecycle + expiry.
- `packages/domain/src/index.mjs`: exports reservation contracts.
- `apps/api/migrations/0012_reservations.sql`: partial unique index (one ACTIVE per item).
- `apps/api/src/modules/commerce/*`: repository/service/HTTP boundary.
- `apps/api/src/modules/listing/postgres-listing-repository.mjs`: `findPublishedByInventoryItem`.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `reservation`, service `reservation-service`, HTTP `reservation-http`, integration `reservation-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Create returns ACTIVE; 23505 → `item_unavailable` (409).
- [x] Only ACTIVE+unexpired reservations convert to CONVERTED.
- [x] Conversion releases the guard (new ACTIVE allowed).
- [x] Customer role required; CSRF/origin protected.
- [x] `npm run verify:ci` passes (incl. concurrency integration).

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 159 application/unit, 0 failures |
| `npm run test:integration` | Pass: 15/15 (incl. reservation concurrency) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 159 unit + 15 integration + 1 smoke |

## Architecture/security review

The DB partial unique index is the authoritative double-sell guard (not app-level checks). Customer role required; exact-origin + CSRF. No financial amounts. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0012_reservations.sql`.

## Remaining work and next safe action

1. E10 order/payment completion (convert reservation → order allocation) and payment gateway adapters.
2. E9 cart persistence and reservation expiry job.
3. E11 fulfilment/shipment.

## Blockers requiring human decision

Payment provider/destination remains a production hard stop.
