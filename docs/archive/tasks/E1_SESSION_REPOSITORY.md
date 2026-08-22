# Task: E1 Transactional Identity and Session Repository

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-session-repository`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0002, ADR 0003

## Objective

Implement PostgreSQL identity/session persistence with atomic initial session creation, access lookup, refresh rotation, reuse-family revocation, and logout revocation.

## Scope

- Customer user plus canonical CUSTOMER role creation.
- Active identity lookup by hashed access credential.
- Initial refresh family/access/refresh creation in one transaction.
- Refresh credential row locking, single-use rotation, old access revocation, and new session issuance atomically.
- Reuse/expired credential response revokes the entire family and all family access sessions.
- Explicit family revocation for logout/security response.

## Non-scope

- HTTP/cookies/CSRF, password orchestration, rate limiting, MFA, reset/contact verification, production database.

## Acceptance criteria

- [x] Raw credentials never reach repository methods or database.
- [x] Initial session persistence is atomic.
- [x] Active access lookup returns user roles and fails after expiry/revocation/family revocation.
- [x] A refresh credential rotates exactly once under row lock.
- [x] Reuse revokes the whole family including the replacement access/refresh.
- [x] Integration tests prove successful rotation and replay response.

## Security review

All credential inputs are 32-byte hashes. Critical transitions use a single PostgreSQL transaction and `FOR UPDATE`. Error results avoid user/credential disclosure.

## Migration and rollback

None; uses existing additive schema.

## Prohibited changes / hard stops

No production data/credentials, destructive SQL, deployment, or plaintext credential persistence.
