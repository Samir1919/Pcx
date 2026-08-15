# Task: E1 PostgreSQL Persistence Foundation

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-persistence-foundation`
- Risk: Security-sensitive
- Related epic: E1 — Identity, Authentication & RBAC
- Related ADRs: ADR 0002, ADR 0003

## Objective

Introduce locked PostgreSQL/Argon2 dependencies, additive identity/session schema migrations, a deterministic migration runner, and database integration-test gates.

## Scope

- Accept ADR 0003 with the user-approved baseline.
- Versioned additive SQL migration for users, addresses, roles, permissions, assignments, access sessions, refresh families/credentials, and auth audit events.
- Migration ledger and transactional migration runner using `pg`.
- Local/CI database test scripts and PostgreSQL CI service.
- Constraints/indexes for contact uniqueness, canonical role/permission identity, session credential uniqueness, refresh rotation lineage, and append-oriented audit facts.

## Non-scope

- HTTP auth endpoints, production credentials, destructive migration, MFA provider, password reset/contact verification delivery, and production deployment.

## Acceptance criteria

- [x] Clean PostgreSQL applies all migrations once and re-running is idempotent.
- [x] Identity/session constraints exist and are integration-tested.
- [x] `npm ci` locks approved dependencies.
- [x] CI provides PostgreSQL and runs migration/integration gates.
- [x] Full verification remains green without requiring a local database for unit-only checks.

## Security review

No plaintext credentials or tokens are stored. Contact uniqueness is case-insensitive for email. Session hashes are unique. Refresh lineage/revocation fields support rotation and reuse response. Audit records have no delete/update application contract.

## Migration and rollback

Additive migration only. Rollback is application rollback while retaining unused tables; destructive down migration is intentionally absent.

## Prohibited changes / hard stops

No production database, secrets, destructive SQL, production deployment, or weakening of the accepted ADR.
