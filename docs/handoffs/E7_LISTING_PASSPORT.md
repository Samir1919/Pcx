# Agent Handoff: E7 Listing, Pricing & Passport

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Approved physical items can be listed as commercial items: draft → publish with server-owned slug and price history (versioned validity windows), plus a safe public passport (`GET /api/v1/passport/:pcxId`) that never leaks serial or acquisition cost.

## Changed areas

- `packages/domain/src/listing/listing.mjs`: `Listing`, `ListingPrice`, `PublicPassport` lifecycle/privacy contracts.
- `packages/domain/src/index.mjs`: exports listing contracts.
- `apps/api/migrations/0011_listings.sql`: additive `listings` (one active per item) + `listing_prices`.
- `apps/api/src/modules/listing/*`: repository/service/HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `listing`, service `listing-service`, HTTP `listing-http`, integration `listing-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] DRAFT → PUBLISHED lifecycle with canonical slug.
- [x] One active listing per item enforced (conflict on violation).
- [x] Prices positive, server-owned, versioned.
- [x] Public passport excludes serial/acquisition-cost/internal evidence.
- [x] Permission-gated writes and CSRF/origin protection.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 148 application/unit, 0 failures |
| `npm run test:integration` | Pass: 14/14 (incl. listing chain) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 148 unit + 14 integration + 1 smoke |

## Architecture/security review

`hasPermission(identity, PRICING_MANAGE)` default deny; exact-origin + CSRF; public passport is a dedicated projection excluding serial/cost/private evidence; asking price server-owned and versioned. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0011_listings.sql`.

## Remaining work and next safe action

1. E8 search/discovery storefront listing queries and product detail.
2. E7 listing media/passport QR and reservation/sold transitions.
3. E6 acquisition payment and cost allocation.

## Blockers requiring human decision

None.
