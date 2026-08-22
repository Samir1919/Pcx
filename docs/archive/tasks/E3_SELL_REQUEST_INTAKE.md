# Task: E3 Sell-to-PCX Request Intake Foundation

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E3 — Sell-to-PCX
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Enable an authenticated seller to create and submit a Sell-to-PCX request as a server-owned DRAFT, with an ownership declaration attached.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 5)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 8, 16, 23)
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md` (Sell-to-PCX flow)

## Scope

- Domain: `createSellRequest`, `submitSellRequest`, `createSellerDeclaration`, `SellRequestStatus`, `FulfilmentPreference`.
- Migration `0007_sell_requests.sql`: `sell_requests` + `seller_declarations` with state/ownership constraints.
- Repository/service/HTTP: authenticated owner-scoped create, list, get, and submit.
- DRAFT → SUBMITTED transition enforced server-side; invalid transition → 409.

## Non-scope

- Estimated range, admin queue, info request/inspection/valuations/offers, media upload, notifications.

## Domain invariants affected

- Sell request status is server-owned; client-supplied status is rejected.
- Owner is derived from the authenticated identity.
- Ownership declaration must be confirmed.
- Estimated range is not a final offer (not yet implemented here).

## Acceptance criteria

- [x] Create returns a server-owned DRAFT with normalized contact and owner.
- [x] Unknown fields, invalid preference, and client-supplied status are rejected.
- [x] Ownership declaration requires confirmation.
- [x] List/get/submit are owner-scoped (no cross-owner access).
- [x] DRAFT-only submit; repeat/illegal transition returns 409.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/sell-requests`, `GET /api/v1/sell-requests`, `GET /api/v1/sell-requests/:id`, `POST /api/v1/sell-requests/:id/submit`. Adds migration `0007`. No UI change.

## Security and privacy review

Owner derived from authenticated identity; object-level ownership enforced in every read/write. Exact-origin + double-submit CSRF on writes. Contact data is accepted but not exposed beyond the owner-scoped response. No acquisition cost/offer.

## Test plan

- Domain: DRAFT ownership, DRAFT→SUBMITTED, declaration confirmation.
- Service: mass assignment, preference, ownership, state transition.
- HTTP: CSRF/origin, 201/200/404/405/409/503, 404 for malformed paths.
- Integration: repository create/submit/owner scoping.

## Migration and rollback

Additive migration `0007_sell_requests.sql`; no destructive change.

## Prohibited changes / hard stops

No estimated-range/final-offer wording, no client-owned price/status, no production deployment.
