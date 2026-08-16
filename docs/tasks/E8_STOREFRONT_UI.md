# Task: E8 Storefront UI Shell (apps/web)

- Status: Complete
- Owner/agent: Cline orchestrator
- Branch: `main`
- Risk: Low
- Related epic: E8 — Search, discovery & storefront
- Related ADRs: ADR 0001, ADR 0002, ADR 0004

## Objective

Provide the customer-facing storefront UI shell in `apps/web` that consumes the public read surface: catalog categories/brands, published listing search (`GET /api/v1/listings`), and the public passport (`GET /api/v1/passport/:pcxId`). The storefront must never render serials, acquisition cost, or private evidence.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 4, 24)
- `docs/specifications/USER_FLOW_SCREEN_MAP.md`
- `docs/handoffs/E8_SEARCH_STOREFRONT.md`
- `apps/admin` (reference Next.js app structure)

## Scope

- `apps/web` Next.js app shell (mirrors `apps/admin` structure).
- `lib/storefront-api.js`: read-only fetch adapter for public endpoints.
- Storefront page: listing search with category/brand filter, sort, cursor pagination.
- Passport page: public passport read for a given `pcxId`.
- Test: `apps/web/test/storefront-api.test.mjs`.

## Non-scope

- Listing media/QR, recommendation engine, dedicated search index.
- Any write/checkout flow, authentication, or client-owned price/status.
- Production deployment.

## Domain invariants affected

- Public listing cards and passports never expose serial, acquisition cost, or private evidence.
- Only PUBLISHED listings are shown.

## Acceptance criteria

- [x] `apps/web` boots as a Next.js app and proxies `/api/:path*` to the API origin.
- [x] Storefront page lists published listings with safe disclosure fields only.
- [x] Category/brand filter, sort, and cursor pagination work against `GET /api/v1/listings`.
- [x] Passport page renders the public passport for a `pcxId`.
- [x] `npm run verify` passes.

## State/API/schema/UI impact

Adds a new Next.js app under `apps/web`. No schema change. No API change (consumes existing public endpoints).

## Security and privacy review

Read-only public surface. No serial/cost/private evidence rendered. No write endpoints exposed.

## Test plan

- Adapter test: public listing search and passport requests hit the correct paths with no client-owned fields.

## Migration and rollback

None (new app only; no schema change).

## Prohibited changes / hard stops

No listing media/private evidence, no client-owned price/status, no production deployment, no write/checkout flow.
