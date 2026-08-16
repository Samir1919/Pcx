# Task: E7 Listing, Pricing & Passport

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E7 — Listing, pricing & passport
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Publish approved physical items as commercial listings with server-owned price history and a safe public passport that never leaks serials or acquisition cost.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 9)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 11, 24)
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md` (Section 9)

## Scope

- Domain: `Listing`, `ListingPrice`, `PublicPassport` with server-owned status/publish/price.
- Migration `0011_listings.sql`: `listings` (one active per item) + `listing_prices` (price history).
- Repository/service/HTTP: `PRICING_MANAGE`-gated draft/publish/price; public `GET /passport/:pcxId`.

## Non-scope

- Search/storefront listing queries, listing media, warranty-policy rendering, reservation/sold transitions.

## Domain invariants affected

- One InventoryItem can have at most one active sellable listing.
- Asking price is server-owned and versioned (price history).
- Public passport exposes only approved disclosure fields; no serial/cost/private evidence.

## Acceptance criteria

- [x] Listing is created DRAFT and published only from DRAFT/PAUSED with canonical slug.
- [x] Publish enforces the one-active-listing-per-item constraint (conflict on violation).
- [x] Prices are positive, server-owned, and versioned with a validity window.
- [x] Public passport excludes serial/acquisition-cost/internal evidence.
- [x] Permission-gated writes and CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/admin/listings`, `POST /api/v1/admin/listings/:id/publish`, `POST /api/v1/admin/listings/prices`, `GET /api/v1/passport/:pcxId`. Adds migration `0011`. No UI change.

## Security and privacy review

`hasPermission(identity, PRICING_MANAGE)` default deny; exact-origin + CSRF. Public passport is a dedicated projection excluding any serial/cost/private evidence.

## Test plan

- Domain: DRAFT→PUBLISHED lifecycle, slug, price positivity/validity, passport leakage.
- Service: permission gate, publish state, price server ownership, passport privacy.
- HTTP: public passport read-only, CSRF/origin, 201/404/405/409/422/503.
- Integration: draft→publish→price→passport chain + active-listing uniqueness.

## Migration and rollback

Additive migration `0011_listings.sql`.

## Prohibited changes / hard stops

No listing media/shared private evidence, no client-owned price/status, no production deployment.
