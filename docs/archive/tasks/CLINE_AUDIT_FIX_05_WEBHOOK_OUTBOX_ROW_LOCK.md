# Task: CLINE_AUDIT_FIX_05 — Row-locking on webhook outbox dispatch

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Medium (concurrency correctness)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Prevent two concurrent worker processes from fetching and processing the same
pending webhook outbox batch.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #5

## Scope

- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`: add
  `claimPendingWebhookEvents` using `FOR UPDATE SKIP LOCKED` inside a transaction
  plus a short `next_attempt_at` lease.
- `apps/api/src/modules/logistics/shipment-service.mjs`: prefer the claim method
  when the repository provides it.
- `apps/worker/test/composition.test.mjs`: update the fake pool to support the
  transactional claim.

## Non-scope

- No schema change.

## Domain invariants affected

- "An item cannot be sold twice" (unrelated). Outbox processing becomes
  at-least-once but no longer duplicates under concurrency.

## Acceptance criteria

- [x] Concurrent workers claim disjoint rows via `SKIP LOCKED`.
- [x] Service prefers the claim method when present.

## State/API/schema/UI impact

None.

## Security and privacy review

No new trust-boundary or sensitive-data exposure.

## Test plan

- Unit: `apps/api/test/shipment-service.test.mjs`, `apps/worker/test/composition.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
