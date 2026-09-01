# Agent Handoff: E9 order/payment shipping + tax allocation

- Status: Complete
- Branch: main
- Latest commit: cd5193e
- Date: 2026-09-01

## Outcome

Order totals now include a server-derived shipping and tax allocation. The server
computes shipping (flat ৳60, free above ৳5000) and VAT (5% of subtotal) from the
subtotal — never from client input — and the total is
`subtotal + shipping + tax - discount`. The customer order confirmation renders
the breakdown read-only.

## Changed areas

- `packages/domain/src/commerce/order-payment.mjs` — `createOrder` gains
  `taxAmount`; new `deriveOrderAllocation` pure helper.
- `packages/domain/src/index.mjs` — export `deriveOrderAllocation`.
- `apps/api/migrations/0039_orders_tax.sql` — `tax_amount` column + updated
  `orders_check` totals invariant (now includes tax).
- `apps/api/src/modules/commerce/postgres-order-payment-repository.mjs` — map +
  insert `tax_amount`.
- `apps/api/src/modules/commerce/order-payment-service.mjs` — `createOrder` wires
  `deriveOrderAllocation`.
- `apps/web/app/passport/BuyFlow.js` + `apps/web/app/globals.css` — read-only
  order breakdown (subtotal/shipping/tax/total).
- Tests: domain, service, integration (order-payment + migrations), and the
  migrations list.

## Acceptance criteria

- [x] Server-derived shipping/tax allocation on orders (never client-authored).
- [x] Total = subtotal + shipping + tax - discount (DB CHECK enforced).
- [x] Customer surface renders the breakdown read-only.

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/order-payment.test.mjs` | pass |
| `node --test apps/api/test/order-payment-service.test.mjs` | pass |
| `node --test apps/api/test/integration/order-payment-repository.test.mjs` | pass (DB) |
| `PCX_HEADED=1 node scripts/storefront-e2e-check.mjs --evidence` | 16/16 pass |
| `npm test` (unit) | 0 fail |
| `npm run lint` / `typecheck` / `security` / `ui-guard` | pass |

Note: two integration tests (`sell-request-repository`, `sell-taxonomy-repository`)
fail against the shared local `pcx` DB from prior-run pollution — pre-existing.
`npm run build` fails locally under Node v26.4.0 — pre-existing.

## Architecture/security review

- Totals remain server-owned: the client supplies only unit prices in the item
  snapshots; shipping/tax are derived server-side.
- The DB CHECK `orders_check` enforces the totals invariant including tax.

## Schema/configuration/deployment

- Migration `0039_orders_tax.sql` (additive column + constraint update).

## Remaining work and next safe action

- E11 fulfilment (packaging evidence media, return-to-origin).
- E13 warranty (policy authoring, claim inspections, carrier pickup, cost accounting).

## Blockers requiring human decision

- None.
