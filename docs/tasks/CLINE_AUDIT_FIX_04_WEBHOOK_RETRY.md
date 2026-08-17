# Task: CLINE_AUDIT_FIX_04 — Webhook retry budget honored

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Medium (data-processing correctness)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

`markWebhookFailed` must keep a webhook outbox event `PENDING` until its retry
budget is exhausted, instead of unconditionally setting `FAILED` and dropping it
from the retry queue after the first failure.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #4

## Scope

- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`:
  branch `status` between `PENDING`/`FAILED` based on `nextAttemptAt`.
- `apps/api/test/shipment-service.test.mjs`: update the `markWebhookFailed`
  mock to mirror real branching; assert retries stay PENDING.

## Non-scope

- Item #5 (row locking) is handled in a separate commit.

## Domain invariants affected

- "Order snapshots preserve the sold facts" (unrelated). Webhook delivery
  guarantee is strengthened, not changed.

## Acceptance criteria

- [x] Failure with a scheduled retry keeps the event PENDING.
- [x] Failure with exhausted budget sets FAILED.

## State/API/schema/UI impact

None.

## Security and privacy review

No new trust-boundary or sensitive-data exposure.

## Test plan

- Unit: `apps/api/test/shipment-service.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
