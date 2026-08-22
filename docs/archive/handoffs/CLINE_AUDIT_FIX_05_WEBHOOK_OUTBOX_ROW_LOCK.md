# Agent Handoff: CLINE_AUDIT_FIX_05 — Row-locking on webhook outbox dispatch

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: ee3e629
- Date: 2026-08-17

## Outcome

Webhook outbox dispatch now claims due PENDING events with `FOR UPDATE SKIP
LOCKED` inside a transaction plus a short lease, so concurrent worker processes
never fetch and process the same batch.

## Changed areas

- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`: added
  `claimPendingWebhookEvents` (transaction, `FOR UPDATE SKIP LOCKED`, 120s lease).
- `apps/api/src/modules/logistics/shipment-service.mjs`: `dispatchDueWebhookEvents`
  prefers the claim method when the repository provides it.
- `apps/api/test/shipment-service.test.mjs`: added claim-preference test.
- `apps/worker/test/composition.test.mjs`: fake pool now supports the transactional claim.

## Acceptance criteria

- [x] Concurrent workers claim disjoint rows via `SKIP LOCKED`.
- [x] Service prefers the claim method when present.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/shipment-service.test.mjs` | 19/19 pass |
| `node --test apps/worker/test/composition.test.mjs` | 3/3 pass |
| `npm test` | 330 pass, 22 skip, 0 fail |

## Architecture/security review

Outbox processing moves to at-least-once with no duplicate concurrent claims.
No new trust-boundary exposure.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

- Item #6: payment credentials key startup guard (`credentials-cipher.mjs`).

## Blockers requiring human decision

None for item #5.
