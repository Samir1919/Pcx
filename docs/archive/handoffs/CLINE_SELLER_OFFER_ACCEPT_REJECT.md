# Agent Handoff: Seller-owned offer accept/reject (E6)

- Status: Complete
- Branch: `agent/web-sell-post-price-redirect`
- Latest commit: `2bf0832`
- Date: 2026-08-22

## Outcome

A customer (seller) can now accept or reject their own final offer directly from the public storefront API. The server enforces ownership (the authenticated CUSTOMER must own the sell request behind the offer) and the ACTIVE→ACCEPTED/REJECTED transition; acceptance still enforces expiry. Admin remains responsible for valuation + final offer creation + acquisition + payment.

## Changed areas

- `packages/domain/src/acquisition/valuation-offer.mjs` — added `rejectOffer` (terminal ACTIVE→REJECTED).
- `packages/domain/src/index.mjs` — exported `rejectOffer`.
- `apps/api/src/modules/acquisition/postgres-acquisition-repository.mjs` — added `rejectOffer` and `findOwnerUserIdByOffer` (join `sell_requests`).
- `apps/api/src/modules/acquisition/acquisition-service.mjs` — added `acceptOfferForCustomer` / `rejectOfferForCustomer` with `ownerOfOffer` guard (CUSTOMER + ownership).
- `apps/api/src/modules/acquisition/acquisition-http.mjs` — public routes `POST /api/v1/offers/:id/accept` and `/reject`.
- `apps/web/lib/storefront-api.js` — `acceptOffer` / `rejectOffer` helpers.
- `apps/api/test/acquisition-service.test.mjs` — new ownership/accept/reject tests.

## Acceptance criteria

- [x] Seller can accept their own ACTIVE offer (expiry enforced).
- [x] Seller can reject their own ACTIVE offer (terminal).
- [x] Non-owner or non-CUSTOMER is forbidden (403).

## Verification

| Command | Result |
|---|---|
| `npm test` | 479 pass, 0 fail, 23 skipped |
| verify:e0 / lint / typecheck / build / security | pass |
| `node scripts/live-verify.mjs admin-inventory` + `sell-flow` | PASS |

## Architecture/security review

- Ownership is enforced server-side via `findOwnerUserIdByOffer` join over `sell_requests.user_id`; no client-authoritative owner.
- Amount remains server-owned; the customer only commits to/rejects the already-created offer.
- This realigns implementation with spec `USER_FLOW_SCREEN_MAP.md` S13-S14 (Seller Accept/Reject).

## Schema/config/deployment

None.

## Remaining

Acquisition cost allocation (`item_costs`) remains; storefront UI to render the seller's final offer (S13/S14) is the next storefront-surface step.
