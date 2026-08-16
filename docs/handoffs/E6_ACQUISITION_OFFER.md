# Agent Handoff: E6 Acquisition, Cost & Final Offer

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

The financial chain valuation → final offer → acceptance → acquisition is implemented. Valuation is an estimate that can never be used as a final offer; an offer is server-owned and only ACTIVE+unexpired offers can be accepted; an acquisition captures an immutable server-derived agreed price and enforces idempotency.

## Changed areas

- `packages/domain/src/acquisition/valuation-offer.mjs`: valuation/offer/acquisition contracts and lifecycle.
- `packages/domain/src/index.mjs`: exports acquisition financial contracts.
- `apps/api/migrations/0010_acquisition.sql`: additive `valuations`/`offers`/`acquisitions`.
- `apps/api/src/modules/acquisition/postgres-acquisition-repository.mjs`, `acquisition-service.mjs`, `acquisition-http.mjs`.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `valuation-offer`, service `acquisition-service`, HTTP `acquisition-http`, integration `acquisition-repository`; migrations test updated.

## Acceptance criteria

- [x] Valuation low ≤ high and recommended within range.
- [x] Only ACTIVE offers can be accepted.
- [x] Acquisition agreedPrice is server-derived.
- [x] Idempotency key enforces single acquisition.
- [x] Permission-gated and CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 137 application/unit, 0 failures |
| `npm run test:integration` | Pass: 13/13 (incl. acquisition chain) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 137 unit + 13 integration + 1 smoke |

## Architecture/security review

Amounts are server-owned and immutable; client never authors price/totals. Idempotency is enforced by a DB unique key. `hasPermission` default deny (PRICING_MANAGE/ACQUISITION_PAYMENT_MANAGE). No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0010_acquisition.sql`.

## Remaining work and next safe action

1. E6 acquisition payment (server-owned status transition PENDING → PAID) and cost allocation.
2. E8 search/discovery storefront.
3. E3 admin sell-request queue + valuation/offer flows (seller accept/reject).

## Blockers requiring human decision

Payment provider/destination remains a production hard stop.
