# Task: E1 Self-Owned Address Repository

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-address-repository`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0002, ADR 0003

## Objective

Implement PostgreSQL address CRUD constrained to the authenticated owner with transactional one-default handling.

## Scope

- List/create/update/delete by explicit user ID.
- Active CUSTOMER eligibility for creation.
- Ownership predicates on every record mutation.
- Transactional clearing before setting a new default.

## Non-scope

- HTTP/CSRF, admin access, address verification/geocoding, automatic default promotion policy.

## Acceptance criteria

- [x] Another user's address is inaccessible to update/delete.
- [x] Creation requires an active CUSTOMER identity.
- [x] At most one default per owner after create/update.
- [x] Returned DTO excludes unrelated identity data.
- [x] Integration tests prove ownership/default behavior.

## Security and test plan

Parameterized SQL and owner predicates; PostgreSQL integration plus full verify.

## Migration and rollback

None; uses existing addresses table.

## Prohibited changes / hard stops

No cross-owner access, public address exposure, production data, or destructive migration.
