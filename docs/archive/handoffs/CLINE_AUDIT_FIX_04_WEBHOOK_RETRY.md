# Agent Handoff: CLINE_AUDIT_FIX_04 — Webhook retry budget honored

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: f716a83
- Date: 2026-08-17

## Outcome

`markWebhookFailed` now keeps a webhook outbox event `PENDING` (with updated
`retry_count`/`next_attempt_at`) until the retry budget is exhausted; only then
does it flip to `FAILED`. Events are no longer dropped after a single transient
failure.

## Changed areas

- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`: `markWebhookFailed`
  uses a `CASE` on `next_attempt_at IS NULL` to choose `FAILED` vs `PENDING`.
- `apps/api/test/shipment-service.test.mjs`: mock now mirrors real branching;
  asserts a still-scheduled retry stays PENDING and an exhausted budget flips FAILED.

## Acceptance criteria

- [x] Failure with a scheduled retry keeps the event PENDING.
- [x] Failure with exhausted budget sets FAILED.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/shipment-service.test.mjs` | 18/18 pass |
| `npm test` | 329 pass, 22 skip, 0 fail |

## Architecture/security review

Webhook delivery guarantee strengthened. No new trust-boundary exposure.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

- Item #5: row-locking on webhook outbox dispatch (`FOR UPDATE SKIP LOCKED`) —
  requires a transaction-spanning claim plus live-Postgres integration verification.

## Blockers requiring human decision

None for item #4.
