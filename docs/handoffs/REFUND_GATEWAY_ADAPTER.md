# Agent Handoff: Refund gateway adapter execution (E12, sandbox)

- Status: Complete
- Branch: main
- Latest commit: 407a985
- Date: 2026-09-01

## Outcome

`settleRefund` now drives an injected sandbox refund gateway. The provider
transaction id is server-derived and idempotent (deterministic per return +
amount); a replayed settle for an already-REFUNDED return is returned without a
second gateway call; a gateway failure never rolls back the REFUNDED transition
(the authorized financial fact persists and `refund_provider_status='FAILED'` is
recorded for reconciliation).

## Changed areas

- `packages/domain/src/vendor/vendor-adapters.mjs` — `createSandboxRefundGateway`
  (idempotent by reference, secret-free, mirrors `createSandboxPaymentGateway`).
- `packages/domain/src/index.mjs` — export.
- `apps/api/migrations/0038_return_refund_provider.sql` — `refund_provider`,
  `refund_provider_transaction_id` (unique), `refund_provider_status` on
  `return_requests`.
- `apps/api/src/modules/warranty/postgres-return-request-repository.mjs` —
  `settleRefund` persists provider fields; `toRecord`/`columns` updated.
- `apps/api/src/modules/warranty/return-request-service.mjs` — gateway wiring,
  replay-safe short-circuit, FAILED-on-gateway-error handling.
- `apps/admin/app/(workspace)/returns/page.js` — read-only "Refund provider"
  column (status pill + truncated transaction id).
- Tests: vendor-adapters (refund gateway), return-request-service, integration
  return-request-repository + migrations list.

## Acceptance criteria

- [x] settleRefund calls the gateway (service test asserts the gateway is invoked).
- [x] Replay-safe (REFUNDED return returned without a second gateway call).
- [x] Sandbox-only (default `createSandboxRefundGateway`, no real credentials).
- [x] Gateway failure never rolls back REFUNDED (FAILED status recorded).

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/vendor-adapters.test.mjs` | 9/9 pass |
| `node --test apps/api/test/return-request-service.test.mjs` | 6/6 pass |
| `node --test apps/api/test/integration/return-request-repository.test.mjs` | 1/1 pass (DB) |
| `node --test apps/api/test/integration/migrations.test.mjs` | 1/1 pass (DB) |
| `npm run lint` / `typecheck` | pass |
| `npm test` (unit) | 0 fail |

Note: `npm run build` fails locally (`/_global-error` prerender, `useContext` on
null) because local Node is v26.4.0 vs the supported `>=24 <25` (`.nvmrc` = 24) —
pre-existing. Two integration tests (`sell-request-repository`,
`sell-taxonomy-repository`) fail against the shared local `pcx` DB from prior-run
pollution (a `notifications_user_id_fkey` row and `sell_build_components.psu.required`)
— pre-existing; CI runs them against a fresh `pcx_test` DB.

## Architecture/security review

- Follows ADR 0006 (server-authoritative gateway-derived provider transaction id).
- `refund_provider_transaction_id` is unique (partial index) for defense-in-depth
  against duplicate disbursements; the service-level reference idempotency and
  REFUNDED replay guard are the primary controls.
- Write gated by `REFUND_MANAGE`; `refund_provider*` are server-owned and rendered
  read-only in the admin UI.

## Schema/configuration/deployment

- Migration `0038_return_refund_provider.sql` (additive). Rollback: drop the three
  columns (dev/staging only).

## Remaining work and next safe action

- Real bKash HTTP adapter (E10) behind the same gateway contract (sandbox only).
- E5 inspection follow-ups; E7/E8 passport & storefront.

## Blockers requiring human decision

- None. Real provider credentials and production deployment remain hard stops.
