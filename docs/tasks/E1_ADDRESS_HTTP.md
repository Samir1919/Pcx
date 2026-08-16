# Task: E1 Self-Owned Address HTTP Boundary

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-address-http`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Expose authenticated self-owned address CRUD with exact-origin and double-submit CSRF enforcement for writes.

## Scope

- GET/POST `/api/v1/me/addresses`; PATCH/DELETE `/api/v1/me/addresses/:id`.
- Access-cookie authentication through address service.
- Bounded JSON, stable errors, hidden inaccessible resources.
- Runtime address composition and CSRF cookie scope correction to `/api/v1`.

## Non-scope

- Admin address access, geocoding, address verification, automatic default promotion.

## Acceptance criteria

- [x] Reads require authentication; writes additionally require exact origin and matching CSRF.
- [x] Request bodies/IDs are bounded and unexpected fields fail validation.
- [x] Cross-owner/missing items return the same 404.
- [x] Runtime composes the PostgreSQL address repository/service.
- [x] CSRF cookie is available to every protected `/api/v1` write.

## Security and test plan

HTTP security matrix, full verification, PostgreSQL integration, and diff review.

## Migration and rollback

None.

## Prohibited changes / hard stops

No public PII, cross-owner access, wildcard origins, CSRF bypass, or production deployment.
