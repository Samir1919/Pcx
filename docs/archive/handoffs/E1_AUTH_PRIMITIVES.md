# Agent Handoff: E1 Authentication Primitives

- Status: Complete
- Branch: `agent/e1-auth-primitives`
- Latest commit: recorded by Git after verification
- Date: 2026-08-16

## Outcome

Implemented the accepted Argon2id password boundary and opaque access/refresh credential primitives. Password inputs are length/byte bounded, malformed verification fails closed, credentials contain 256 bits of entropy, only deterministic 32-byte hashes are persistence-ready, comparisons are constant-time, and expiry rules match ADR 0003.

## Changed areas

- `apps/api/src/modules/identity/password.mjs`: policy, hash, verify, rehash.
- `apps/api/src/modules/identity/credentials.mjs`: generation, hashing, comparison, expiry.
- `apps/api/test/auth-primitives.test.mjs`: security regressions.
- `docs/tasks/E1_AUTH_PRIMITIVES.md`: bounded task.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/auth-primitives.test.mjs` | Pass — 3/3 |
| `npm run verify` | Pass — 25 pass, 1 database-only skip; lint/typecheck/build pass |
| `git diff --check` | Pass |

## Architecture/security review

Raw opaque credentials are transient strings only; persistence receives SHA-256 buffers. Comparison uses `timingSafeEqual`. Argon2 errors are collapsed to false. No logs, secrets, cookie behavior, database write, or network surface was introduced.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Implement transactional PostgreSQL identity/session repositories, refresh rotation, and family revocation on reuse.

## Blockers requiring human decision

None.
