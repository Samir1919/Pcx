# Task: E1 Authentication Application Service

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-auth-application-service`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Implement transport-independent registration, login, refresh, and logout orchestration over the accepted password, credential, and transactional repository contracts.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` sections 2, 3, 24, 25, and 27
- `docs/specifications/SECURITY_ARCHITECTURE.md` sections 3, 4, 6, 8, 14, and 16
- `docs/brain/security.md`, `docs/brain/api.md`, and `docs/brain/testing.md`
- `docs/adr/0003-authentication-boundary.md`

## Scope

- Register a normalized customer identity with an Argon2id password hash.
- Authenticate active password identities without revealing which credential check failed.
- Issue opaque access/refresh pairs and persist only hashes.
- Rotate refresh credentials and revoke refresh families on logout.
- Require injected abuse-control and security-audit interfaces.

## Non-scope

- HTTP routing, cookies, CSRF/CORS, contact verification, password reset, MFA, production rate-limit implementation, or schema changes.

## Domain invariants affected

- Client input cannot set role or status; registration always uses the repository's canonical CUSTOMER/PENDING_VERIFICATION behavior.
- Authentication and session lifecycle remain server-owned.
- Restricted raw credentials are returned only to the future secure transport boundary and never passed to persistence, audit, or abuse controls.

## Acceptance criteria

- [x] Registration normalizes contacts, bounds/hash passwords, and maps duplicate contacts to a stable conflict result.
- [x] Login has one public invalid-credentials result for missing, wrong-password, and inactive identities.
- [x] Successful login creates one access/refresh family with only credential hashes persisted.
- [x] Refresh maps rotation/replay/expiry outcomes without returning credentials on failure.
- [x] Logout is idempotent from the caller's perspective and attempts family revocation.
- [x] Every action passes through the abuse-control interface and records a secret-free audit event.

## State/API/schema/UI impact

Adds an application-service contract only. No HTTP, schema, or UI change.

## Security and privacy review

All public auth failures are coarse. Password and credential values are excluded from control/audit context. Active status is required for login. Refresh replay response remains transactionally enforced by the repository. The future boundary must provide secure cookies, CSRF, and a production-backed limiter/audit sink.

## Test plan

- Unit: registration, generic login failure, credential hashing, refresh outcomes, logout idempotence, audit/control redaction.
- Integration: existing transactional repository suite remains the replay/concurrency proof.
- E2E/concurrency/security where relevant: deferred HTTP cookie/CSRF and production limiter tests.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

No production data, deployment, credentials, destructive migration, weaker password/session policy, plaintext persistence, or audit/test bypass.
