# Agent Handoff: CLINE_AUDIT_FIX_06 — Payment credentials key startup guard

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: ce59129
- Date: 2026-08-17

## Outcome

`createCredentialsCipher` now fails closed at construction time in production
when `PAYMENT_CREDENTIALS_KEY` is absent or equals the dev-only zero key, so
provider credentials are never encrypted under a predictable default key.

## Changed areas

- `apps/api/src/modules/payment/credentials-cipher.mjs`: added a `env ===
  "production"` guard rejecting the dev-only zero key.
- `apps/api/test/credentials-cipher.test.mjs`: added coverage for dev fallback,
  malformed key, production absence/zero-key rejection, and a real production key.

## Acceptance criteria

- [x] Production with missing/zero key throws.
- [x] Development fallback and a real key still work.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/credentials-cipher.test.mjs` | 6/6 pass |
| `npm test` | 336 pass, 22 skip, 0 fail |

## Architecture/security review

Prevents weak/default-key credential encryption in production.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

- Item #7: pg.Pool timeouts (`apps/api/src/index.mjs`, `migrate.mjs`).

## Blockers requiring human decision

None for item #6.
