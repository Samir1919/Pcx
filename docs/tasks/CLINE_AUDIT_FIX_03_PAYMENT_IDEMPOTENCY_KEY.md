# Task: CLINE_AUDIT_FIX_03 — Payment idempotency key & gateway reuse

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Security-sensitive (medium)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None (bug fix aligned with "payment operations are idempotent")

## Objective

Stop constructing a fresh gateway (with an empty idempotency cache) and a fresh
`randomUUID()` charge reference on every `createPayment` call. Make the charge
reference a deterministic idempotency key so a client retry after a timeout
reuses the same reference, and reuse resolved gateways across calls.

## Source-of-truth references

- `AGENTS.md` (payment/refund/acquisition financial operations are idempotent)
- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #3

## Scope

- `apps/api/src/modules/commerce/order-payment-service.mjs`: derive the charge
  reference as `payment-<orderId>-<amount>`; cache resolved gateways by
  `provider:mode:credentials`.

## Non-scope

- No change to provider credential storage/encryption.
- No change to the repository or HTTP boundary.

## Domain invariants affected

- "Payment operations are idempotent": strengthened via deterministic reference.

## Acceptance criteria

- [x] A retry for the same order+amount reuses the same charge reference.
- [x] Resolved gateway instances are reused (not rebuilt per call).

## State/API/schema/UI impact

None.

## Security and privacy review

- Prevent double-charge on client retry. Reference is server-derived, never
  client-supplied.

## Test plan

- Unit: `apps/api/test/order-payment-service.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- Do not change payment credentials/production.
- Do not weaken security tests.
