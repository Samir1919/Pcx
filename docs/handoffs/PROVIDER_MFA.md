# Agent Handoff: Provider-based Privileged MFA

- Status: Complete
- Branch: `agent/provider-mfa`
- Latest commit: `51312c0`
- Date: 2026-08-23

## Outcome

Task I of `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`. Privileged (ADMIN /
SUPERVISOR / FINANCE / SUPER_ADMIN) login now challenges through a
provider-delivered one-time code (EMAIL→Resend, SMS→bdBulksms) instead of only
the dev-only deterministic code. When no delivery contact or active provider is
configured, login fails closed with `mfa_unavailable` — never a silent bypass.

## Changed areas

- `apps/api/src/modules/identity/provider-mfa.mjs` (new): 6-digit OTP, in-memory
  challenge with a 5-minute TTL, one-time reuse.
- `apps/api/src/modules/identity/postgres-identity-repository.mjs`: added
  `findContactByUserId` (composition-root only).
- `apps/api/src/modules/notification/contact-delivery-service.mjs`: added the
  `MFA` purpose message/subject.
- `apps/api/src/modules/identity/auth-service.mjs`: maps a `beginChallenge`
  failure to `mfa_unavailable` (fail closed).
- `apps/api/src/modules/identity/auth-runtime.mjs`: lazy provider-MFA holder as
  the default `mfa` (explicitly injected `mfa` still wins for dev/tests).

## Acceptance criteria

- [x] Provider MFA adapter uses ContactDeliveryService (MFA purpose).
- [x] Injected as `mfa` in auth-runtime; fails closed when provider config absent.
- [x] Auth-service MFA fail-closed test + provider-mfa unit tests.
- [x] `npm run verify` green (560 tests / 0 fail).

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (560 tests, 533 pass, 0 fail, 27 skipped) |
| `node --test apps/api/test/provider-mfa.test.mjs` | 5 pass |
| `node --test apps/api/test/auth-service.test.mjs` | 17 pass |
| `TEST_DATABASE_URL=... npm run test:integration` | 27/27 pass |

## Architecture/security review

- No price/role/status/grade invariant changed.
- Client never supplies the MFA user id; the challenge maps server-side to the
  user that was resolving at `beginChallenge` time.
- OTP is ephemeral and never persisted; delivery is synchronous and best-effort.
- A missing contact/provider yields `mfa_unavailable` (fail closed), preserving
  the existing privileged MFA boundary.

## Remaining work / next safe action

1. J — Staging compose smoke (no deploy).
2. Real provider credentials/activation remain a human hard stop.

## Blockers requiring human decision

None. Real provider credentials/activation remain a human hard stop.
