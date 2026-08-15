# Agent Handoff: E1 PostgreSQL Persistence Foundation

- Status: Complete
- Branch: `agent/e1-persistence-foundation`
- Latest commit: recorded by Git after verification
- Date: 2026-08-16

## Outcome

ADR 0003 is accepted with the user-approved authentication baseline. PCX now has locked `pg`/`argon2` dependencies, additive identity/session migrations, canonical RBAC seeds, a checksum-protected transactional migration runner, PostgreSQL integration tests, and CI database gates.

## Changed areas

- `docs/adr/0003-authentication-boundary.md`: accepted auth/persistence/crypto/session decision.
- `apps/api/migrations/0001_identity_auth.sql`: identity, address, RBAC, opaque-session, refresh-rotation and audit schema.
- `apps/api/migrations/0002_identity_policy_seed.sql`: canonical roles, permissions and separation-of-duty grants.
- `apps/api/src/infrastructure/database/migrate.mjs`: ordered transactional/checksummed runner with advisory lock.
- `apps/api/test/integration/migrations.test.mjs`: repeatability, schema, policy and constraint tests.
- `.github/workflows/ci.yml`: PostgreSQL 17 service and CI integration gate.
- package manifests/lock and `.env.example`: approved dependencies and local/test connection configuration.

## Acceptance criteria

- [x] Repeatable/checksummed migrations: integration test passes twice.
- [x] Identity/session constraints: case-insensitive email and 32-byte credential-hash checks pass.
- [x] Canonical policy seed: 8 roles, 18 permissions, full super-admin and restricted admin verified.
- [x] Locked clean install: `npm ci` succeeds; Argon2 loads.
- [x] CI-equivalent gate: unit, migration, integration, lint, typecheck and build pass.

## Verification

| Command/test | Result |
|---|---|
| `npm ci` | Pass; 0 vulnerabilities |
| `npm audit --audit-level=high` | Pass; 0 vulnerabilities |
| `npm run verify` | Pass; 23/23 tests with database available |
| `npm run test:integration` | Pass; 1/1 |
| `npm run verify:ci` | Pass |
| `git diff --check` | Pass |

## Architecture/security review

Credential columns accept only 32-byte hashes and are unique. Refresh family/parent/replacement fields support transactional rotation and reuse response. Email uniqueness is case-insensitive. Role grants match the domain matrix: admin cannot assign roles; super-admin owns the dedicated permission. Migrations are additive and checksum-protected. No plaintext credential, production secret, or destructive down migration exists.

The development Argon2id baseline follows OWASP minimum guidance. Runtime calibration remains required before production, and weakening needs security review.

## Schema/configuration/deployment

Two additive migrations. New local/test variables: `DATABASE_URL`, `TEST_DATABASE_URL`. CI uses an isolated synthetic PostgreSQL database. No production deployment/configuration.

## Remaining work and next safe action

1. Implement password hashing/verification and opaque credential primitives.
2. Implement PostgreSQL identity/session repositories and transactional refresh rotation/reuse revocation.
3. Expose registration/login/refresh/logout with audit and abuse controls.

## Blockers requiring human decision

None for the next bounded E1 implementation slice. Production deployment and real secrets remain hard stops.
