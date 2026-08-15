# Agent Handoff: E8 Public Listing Search & Storefront API

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

The public storefront read surface is available via `GET /api/v1/listings`: a safe, paginated, searchable listing endpoint returning only PUBLISHED items with approved disclosure fields (no serial/cost/private evidence).

## Changed areas

- `packages/domain/src/listing/listing.mjs`: `createPublicListing` safe card projection.
- `packages/domain/src/index.mjs`: export.
- `apps/api/src/modules/listing/postgres-listing-repository.mjs`: `searchPublished` (filter/cursor/sort).
- `apps/api/src/modules/listing/listing-service.mjs`: `searchPublic` safe mapping.
- `apps/api/src/modules/listing/listing-http.mjs`: `GET /api/v1/listings` allow-listed query.
- Tests: domain `listing`, service `listing-service`, HTTP `listing-http`, integration `listing-repository`.

## Acceptance criteria

- [x] Safe public cards (no serial/cost fields).
- [x] Allow-listed, bounded query params (limit 1–50; sorts newest/price_asc/price_desc).
- [x] Cursor pagination next-cursor behavior.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 151 application/unit (137 non-DB + 14 DB-skipped when no URL) |
| `npm run test:integration` | Pass: 14/14 |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + unit + 14 integration + 1 smoke |

## Architecture/security review

Projection-only public DTO; only PUBLISHED listings returned; query params allow-listed and bounded; no serial/cost/private evidence. No hard stop bypassed.

## Schema/configuration/deployment

None (no schema change).

## Remaining work and next safe action

1. E8 storefront UI shell (apps/web) consuming public catalog + listings + passport.
2. E7 listing media/QR and reservation/sold transitions.
3. E6 acquisition payment and cost allocation.

## Blockers requiring human decision

None.
