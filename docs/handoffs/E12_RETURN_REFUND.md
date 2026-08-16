# Agent Handoff: E12 Return & Refund

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Customers can request a return for a sold item and staff with `REFUND_MANAGE` move it REQUESTED→APPROVED→RECEIVED→REFUNDED, with a database-enforced single-refundable-return-per-item guard.

## Changed areas

- `packages/domain/src/warranty/return-refund.mjs`: `ReturnRequest` lifecycle + refund settlement.
- `packages/domain/src/index.mjs`: exports.
- `apps/api/migrations/0015_return_requests.sql`: `return_requests` with one-refundable-per-item partial unique index + lifecycle constraints.
- `apps/api/src/modules/warranty/*`: repository/service/HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `return-refund`, service `return-request-service`, HTTP `return-request-http`, integration `return-request-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Customer creates REQUESTED for an existing order item; duplicates → 409.
- [x] Only REQUESTED→APPROVED→RECEIVED→REFUNDED transitions allowed.
- [x] `REFUND_MANAGE` required for approve/receive/refund.
- [x] Refund idempotency via one-refundable-per-item index.
- [x] CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 184 application/unit, 0 failures |
| `npm run test:integration` | Pass: 18/18 (incl. return/refund) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 184 unit + 18 integration + 1 smoke |

## Architecture/security review

Customer role for request; `REFUND_MANAGE` for settlement; server-owned lifecycle; DB-enforced single refund per item; exact-origin + CSRF. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0015_return_requests.sql`.

## Remaining work and next safe action

1. E13 warranty & claims lifecycle + resolutions.
2. E12 refund gateway execution + physical serial-match intake.
3. E14 admin operations & reporting.

## Blockers requiring human decision

Refund payment destination/provider remains a production hard stop.
