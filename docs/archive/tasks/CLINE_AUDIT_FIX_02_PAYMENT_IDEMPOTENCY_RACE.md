# Task: CLINE_AUDIT_FIX_02 — TOCTOU race in payment idempotency cache

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Security-sensitive (medium)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None (bug fix aligned with "payment is idempotent" invariant)

## Objective

Eliminate the time-of-check/time-of-use race in the sandbox and bKash payment
gateway idempotency caches where two concurrent `charge` calls with the same
reference both pass the `seen.has()` check and both perform a real charge.

## Source-of-truth references

- `AGENTS.md` (invariants: payment/refund/acquisition financial operations are idempotent)
- `docs/brain/domain-rules.md`
- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #2

## Scope

- `packages/domain/src/vendor/vendor-adapters.mjs`: store the in-flight promise in
  the `seen` map immediately after the `has` check (before awaiting the real
  charge), so concurrent callers await the same promise. Delete the entry on
  failure to avoid caching a rejected charge.
- Add concurrency tests for both the sandbox and bKash gateways.

## Non-scope

- The courier adapter has no idempotency cache and is out of scope.
- No changes to gateway caller wiring or credentials.

## Domain invariants affected

- "Payment operations are idempotent": strengthened by making same-reference
  concurrency share a single charge.

## Acceptance criteria

- [x] Two concurrent same-reference charges invoke the real `charge` only once.
- [x] Both callers receive the same provider transaction id.

## State/API/schema/UI impact

None.

## Security and privacy review

- Prevents double-charge under concurrency. No new sensitive-data exposure.

## Test plan

- Unit: `packages/domain/test/vendor-adapters.test.mjs`, `apps/api/test/bkash-gateway.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- Do not change payment credentials/production.
- Do not weaken security tests.
