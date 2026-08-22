# Task: CLINE_AUDIT_FIX_06 — Payment credentials key startup guard

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Security-sensitive
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Fail closed at startup in production when `PAYMENT_CREDENTIALS_KEY` is absent or
the dev-only zero key, instead of silently encrypting provider credentials under
a deterministic all-zero key.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #6

## Scope

- `apps/api/src/modules/payment/credentials-cipher.mjs`: add a production guard
  that rejects the dev-only zero key.

## Non-scope

- No change to key format or cipher algorithm.

## Domain invariants affected

- "Payment provider credentials never exposed": strengthened by not allowing a
  predictable zero key in production.

## Acceptance criteria

- [x] `env === "production"` with a missing/zero key throws.
- [x] Development and a real key still work.

## State/API/schema/UI impact

None.

## Security and privacy review

Prevents weak/default-key credential encryption in production.

## Test plan

- Unit: `apps/api/test/credentials-cipher.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- Do not change the key format or cipher algorithm silently.
