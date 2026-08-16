# Task: E1 Identity Action Token Persistence

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-identity-action-tokens`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0002, ADR 0003

## Objective

Add single-use hashed contact-verification and password-reset token persistence with atomic identity/security transitions.

## Source-of-truth references

- `AGENTS.md`
- Security Architecture sections 4, 6, 8, 14, 16
- API Specification section 3 and validation/security rules
- ADR 0002 and ADR 0003

## Scope

- Additive identity-action token table for verification/reset purposes.
- Persist only 32-byte credential hashes.
- Reissue revokes earlier unused tokens for the same user/purpose.
- Contact verification atomically consumes token and activates/verifies the user.
- Password reset atomically consumes token, replaces Argon2id password, revokes other action tokens, refresh families, and access sessions.
- Integration proof for single use, expiry, reissue, and session revocation.

## Non-scope

- Email/SMS provider delivery, HTTP/application endpoints, MFA, production migration, or retention cleanup job.

## Domain invariants affected

- Identity status changes remain server-owned.
- Restricted raw tokens never enter persistence.
- Password reset invalidates existing authenticated sessions.

## Acceptance criteria

- [x] Migration is additive, repeatable, constrained, and indexed.
- [x] Repository rejects raw/malformed hashes and non-Argon2id passwords.
- [x] Reissue revokes prior active same-purpose credentials.
- [x] Verification/reset token consumes exactly once under row lock.
- [x] Reset atomically revokes all user sessions and remaining action tokens.

## State/API/schema/UI impact

Adds `identity_action_tokens`; no endpoint/UI change.

## Security and privacy review

Only SHA-256 hashes are stored. Purpose is constrained. Token selection and transition use row locks. Public results are coarse. Reset invalidates the complete session surface.

## Test plan

- Unit input contract tests.
- PostgreSQL integration for issue/reissue/consume/expiry/session revocation.
- Full `npm run verify:ci`.

## Migration and rollback

Additive migration `0003_identity_action_tokens.sql`. Rollback before production is dropping only the new unused table; destructive production rollback remains a hard stop.

## Prohibited changes / hard stops

No production migration/data, raw token storage, weaker password policy, destructive operations, or deployment.
