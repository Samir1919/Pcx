# Task: E8 Public Listing Search & Storefront API

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E8 — Search, discovery & storefront
- Related ADRs: ADR 0001, ADR 0002

## Objective

Provide the public storefront read surface over published listings: a safe, paginated, searchable listing endpoint that never leaks serial/acquisition/private evidence.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 4, 24)
- `docs/specifications/DATABASE_ERD.md` (Section 9)

## Scope

- Domain: `createPublicListing` safe disclosure projection.
- Repository: `searchPublished` filter/cursor/sort over PUBLISHED listings.
- Service: `searchPublic` maps rows to safe cards.
- HTTP: `GET /api/v1/listings` with allow-listed `categoryId`, `brandId`, `q`, `cursor`, `limit`, `sort`.

## Non-scope

- Listing media/QR, recommendation engine, dedicated search index, storefront UI shell.

## Domain invariants affected

- Public listing cards never expose serial, acquisition cost, or private evidence.
- Only PUBLISHED listings are returned.

## Acceptance criteria

- [x] `searchPublic` returns safe cards with no serial/cost fields.
- [x] Query params are allow-listed and bounded (limit 1–50; sorts newest/price_asc/price_desc).
- [x] Cursor pagination returns a next-cursor and stops correctly.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `GET /api/v1/listings`. No schema change (uses existing `0011_listings.sql`). No UI change.

## Security and privacy review

Projection-only public DTO; no internal record serialization; no acquisition cost/serial leakage.

## Test plan

- Domain: public listing card privacy.
- Service: safe card projection and filter pass-through.
- HTTP: method/query allow-list, 400 for bad filters.
- Integration: published listing search returns the seeded card with no cursor overflow.

## Migration and rollback

None (no schema change).

## Prohibited changes / hard stops

No listing media/private evidence, no client-owned price/status, no production deployment.
