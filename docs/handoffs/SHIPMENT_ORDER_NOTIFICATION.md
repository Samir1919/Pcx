# Agent Handoff: Shipment Shipped / Order Delivered Customer Notifications

- Status: Complete
- Branch: `agent/shipment-order-notify`
- Latest commit: `f756397`
- Date: 2026-08-23

## Outcome

Task H of `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`. The logistics module
now emits customer notifications on shipment state changes: `SHIPMENT_SHIPPED`
when a shipment is shipped and `ORDER_DELIVERED` when it is delivered. The buyer
is resolved through a composition-root public method on the commerce module
(`getUserIdByOrder`), not a raw cross-module table query, preserving the
modular-monolith boundary.

## Changed areas

- `apps/api/src/modules/commerce/postgres-order-payment-repository.mjs`: added
  `findUserIdByOrder(orderId)` (composition-root only, never exposed over HTTP).
- `apps/api/src/modules/commerce/order-payment-service.mjs`: added public
  `getUserIdByOrder(orderId)`.
- `apps/api/src/modules/logistics/shipment-service.mjs`: accepts
  `notificationEmitter` + `orderUserResolver`; emits SHIPMENT_SHIPPED on ship and
  ORDER_DELIVERED on deliver (admin action, courier webhook, and worker
  dispatch paths). Emit is best-effort and never rolls back the transition.
- `apps/api/src/modules/identity/auth-runtime.mjs`: wires the resolver +
  emitter into the shipment service.
- `apps/worker/src/composition.mjs`: wires the worker's shipment service +
  shared notification outbox so delivery webhook dispatch also emits.
- `apps/api/test/shipment-service.test.mjs`: unit tests for emit behavior.
- `apps/api/test/integration/shipment-notification.test.mjs` (new): full
  order→ship→deliver→PENDING-row flow.

## Acceptance criteria

- [x] `orderUserResolver({ orderId }) → userId` injected via composition-root.
- [x] SHIPMENT_SHIPPED emitted after ship; ORDER_DELIVERED emitted after deliver.
- [x] Emit is best-effort: notification failure never fails the shipment.
- [x] Missing/unknown buyer skips the emit without failing the transition.
- [x] Integration test: order → ship/deliver → PENDING notification rows.
- [x] `npm run verify` green (554 tests / 0 fail).

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (554 tests, 527 pass, 0 fail, 27 skipped) |
| `npm run lint` | Pass |
| `node scripts/typecheck-check.mjs` | Pass |
| `node --test apps/api/test/shipment-service.test.mjs` | 24 pass |
| `node --test apps/api/test/integration/shipment-notification.test.mjs` (TEST_DATABASE_URL set) | 1 pass |

## Architecture/security review

- No price/role/status/grade invariant changed.
- Cross-module lookup goes through the commerce module's public service method
  (`getUserIdByOrder`), NOT a raw `orders` table access from logistics.
- Emit is best-effort and post-success; a notification failure cannot roll back
  a shipment transition.
- No new schema/migration; the notification outbox rows use the existing
  deterministic idempotent emitter.

## Remaining work / next safe action

1. I — Provider-based MFA (SMS/Email OTP) using `ContactDeliveryService`.
2. J — Staging compose smoke (no deploy).
3. Real provider credentials/activation remain a human hard stop.

## Blockers requiring human decision

None.
