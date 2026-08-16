# Agent Handoff: E10 Order & Payment

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Orders are created with server-computed totals and sold-fact snapshots; payments are recorded with idempotency via a unique provider transaction id and can be confirmed only once from INITIATED.

## Changed areas

- `packages/domain/src/commerce/order-payment.mjs`: `Order`, `OrderItemSnapshot`, `Payment` contracts.
- `packages/domain/src/index.mjs`: exports.
- `apps/api/migrations/0013_orders_payments.sql`: `orders`, `order_items`, `payments` with total invariant + unique provider txn.
- `apps/api/src/modules/commerce/order-payment-*`: repository/service/HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `order-payment`, service `order-payment-service`, HTTP `order-payment-http`, integration `order-payment-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Order total = subtotal + shipping - discount, non-negative.
- [x] Order items reject negative price and snapshot sold facts.
- [x] Payment duplicate by provider txn → 409.
- [x] Payment confirm only from INITIATED, once.
- [x] Customer role required; CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 168 application/unit, 0 failures |
| `npm run test:integration` | Pass: 16/16 (incl. order/payment) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 168 unit + 16 integration + 1 smoke |

## Architecture/security review

Server-computed totals; sold-fact snapshots; unique provider txn id idempotency at DB level; customer role + CSRF/origin. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0013_orders_payments.sql`.

## Remaining work and next safe action

1. E10 payment gateway/webhook processing + refunds (provider is a production hard stop).
2. E11 fulfilment/shipment courier adapter.
3. E12 return/refund.

## Blockers requiring human decision

Payment provider/destination remains a production hard stop.
