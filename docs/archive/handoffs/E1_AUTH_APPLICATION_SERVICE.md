# Agent Handoff: E1 Authentication Application Service

- Status: Complete
- Branch: `agent/e1-auth-application-service`
- Latest commit: recorded by Git after verification
- Date: 2026-08-16

## Outcome

Implemented transport-independent registration, login, refresh, and logout orchestration over the accepted Argon2id, opaque-credential, and transactional session repository contracts. Inactive and invalid identities share one denial, unknown identities still perform password verification work, abuse checks fail closed, and audit/control payloads exclude raw credentials and passwords.

## Changed areas

- `apps/api/src/modules/identity/auth-service.mjs`: authentication orchestration and stable application errors.
- `apps/api/test/auth-service.test.mjs`: security-focused unit coverage for all four actions.
- `docs/tasks/E1_AUTH_APPLICATION_SERVICE.md`: bounded source-of-truth, scope, and acceptance record.

## Acceptance criteria

- [x] Registration owns status/role defaults and persists an Argon2id hash.
- [x] Login collapses missing, wrong-password, and inactive identity failures.
- [x] Successful login persists only access/refresh hashes.
- [x] Refresh exposes no replacement credentials on invalid, expired, or replay outcomes.
- [x] Logout is caller-idempotent.
- [x] Abuse and audit interfaces are required and secret-free in tests.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/auth-service.test.mjs` | Pass — 6/6 |
| `npm run verify:e0` | Pass — 36 required artifacts |
| `npm test` | Pass — 31 passed, 2 PostgreSQL-dependent tests skipped without test database |
| `npm run verify` | Pass — E0, lint, typecheck, unit tests, build |
| `git diff --check` | Pass |

## Architecture/security review

The API module remains the authentication boundary under ADR 0003. The service does not accept client-owned role/status, never sends raw credentials to repository/audit/control dependencies, uses a policy-compatible dummy hash for missing-identity verification, rejects inactive identities, and maps all refresh failures to one caller-visible category. Refresh replay/family revocation remains enforced transactionally by the existing repository integration suite.

Audit writes currently use an injected interface after persistence succeeds; a production implementation should make committed auth state and durable audit delivery atomic (transactional insert/outbox) before launch. This is not weakened or silently treated as production-ready.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Implement the versioned `/api/v1/auth/register|login|refresh|logout` HTTP boundary with bounded JSON parsing, Secure/HttpOnly/SameSite cookies, CSRF enforcement for cookie-authenticated state changes, stable status/error mapping, and concrete local abuse/audit adapters. Preserve the service contract and add HTTP security tests.

## Blockers requiring human decision

None.
