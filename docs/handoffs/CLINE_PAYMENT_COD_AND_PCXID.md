# Agent Handoff: COD payment + server-derived PCX ID + grade/health on listing/passport

- Status: Complete
- Branch: `agent/web-sell-post-price-redirect`
- Latest commit: `51e46f3`
- Date: 2026-08-22

## Outcome

Three bounded slices landed and verified:

1. **Server-derived PCX ID** — inventory intake now generates `PCX-########` from the item UUID; `pcxItemId` is no longer client-authored.
2. **Grade/health on public listing + passport** — published listing cards and the public passport surface the inspection-derived `condition_grade` and `current_health_score`.
3. **COD payment** — `PaymentMethod.COD` is a first-class, gateway-free, idempotent method; the storefront `BuyFlow` now uses COD (pay on delivery) and does not auto-confirm cash collection.

## Changed areas

- `packages/domain/src/inventory/inventory-item.mjs` — `generatePcxItemId()` (SHA1 → `PCX-xxxxxxxx`).
- `packages/domain/src/commerce/order-payment.mjs` — `PaymentMethod` enum (`BKASH`, `COD`); `createPayment` validates method.
- `packages/domain/src/index.mjs` — exports `generatePcxItemId`, `PaymentMethod`.
- `apps/api/src/modules/inventory/inventory-service.mjs` — server derives PCX ID; rejects client `pcxItemId`.
- `apps/api/src/modules/listing/postgres-listing-repository.mjs` + `listing-service.mjs` — include grade/health in `findPublicPassport` and `searchPublished`.
- `apps/api/src/modules/commerce/order-payment-service.mjs` — COD branch (no gateway charge, deterministic `cod-<order>-<amount>` provider txn id); `provider` no longer accepted from client.
- `apps/web/app/passport/BuyFlow.js` — COD flow; no auto-confirm of cash.
- Tests: `inventory-service.test.mjs`, `order-payment.test.mjs`, `order-payment-service.test.mjs` updated/extended.

## Acceptance criteria

- [x] Client cannot author PCX ID; it is deterministic and server-owned.
- [x] Public listing/passport expose grade and health for published items.
- [x] COD always available as a payment method, gateway-free and idempotent.
- [x] Provider identity and provider transaction id are never client-authoritative.

## Verification

| Command | Result |
|---|---|
| `npm test` | 476 pass, 0 fail, 23 skipped |
| `npm run verify:e0` / `lint` / `typecheck` / `build` / `security` | All pass |
| `node scripts/live-verify.mjs admin-inventory` | PASS |
| `node scripts/live-verify.mjs sell-flow` | PASS |

## Architecture/security review

- PCX ID from UUID hash keeps uniqueness without a counter; no serial/cost leaks.
- COD stays INITIATED until delivery; cash collection becomes CONFIRMED server-side later (payment reconcile slice).
- Payment `method` allow-list fixes the original `createPayment` accepting arbitrary strings (`"mobile"` previously used) — an input-surface tightening.
- bKash live credentials remain a hard stop (sandbox only).

## Schema/configuration/deployment

None beyond the previously committed additive migration `0029`.

## Remaining work / next

Reservation expiry job (E9) is next: expire ACTIVE reservations whose `reserved_until` has passed, releasing the physical item for re-sale.
