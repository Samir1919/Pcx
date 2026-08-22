# Task: E9 Cart, Reservation & Checkout (Double-Sell Protection)

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E9 — Cart, reservation & checkout
- Related ADRs: ADR 0001, ADR 0002

## Objective

Guard a physical item from being sold twice via a bounded reservation with a database-enforced one-active-per-item constraint.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 10)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 22, 24)

## Scope

- Domain: `Reservation` ACTIVE→CONVERTED lifecycle, expiry detection.
- Migration `0012_reservations.sql`: partial unique index (one ACTIVE per item).
- Repository/service/HTTP: create (customer-gated, PUBLISHED-listing required), convert, read-active.

## Non-scope

- Cart persistence, order/payment completion, reservation expiry job.

## Domain invariants affected

- At most one ACTIVE reservation per physical item (double-sell guard).
- Reservation created only against a PUBLISHED listing and a real customer.

## Acceptance criteria

- [x] Create returns ACTIVE and maps 23505 to `item_unavailable` (409).
- [x] Only ACTIVE+unexpired reservations convert to CONVERTED.
- [x] After conversion a new ACTIVE reservation is allowed (guard releases correctly).
- [x] Customer role required; CSRF/origin protected.
- [x] `npm run verify:ci` passes (incl. concurrency integration).

## State/API/schema/UI impact

Adds `POST /api/v1/reservations`, `POST /api/v1/reservations/:id/convert`, `GET /api/v1/reservations/:inventoryItemId/active`. Adds migration `0012`.

## Security and privacy review

Customer role required; exact-origin + CSRF; DB partial unique index is authoritative and can't be bypassed at application layer; no financial amounts involved.

## Test plan

- Domain: lifecycle, expiry.
- Service: permission, listing existence, 23505→409, conversion expiry.
- HTTP: CSRF/origin, 201/200/404/405/409/503.
- Integration: second ACTIVE insertion rejected, conversion releases the guard.

## Migration and rollback

Additive migration `0012_reservations.sql`.

## Prohibited changes / hard stops

No payment/order completion, no weakening the unique-active constraint, no production deployment.
