# Task: E2 Public Catalog API Boundary

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e2-public-catalog-api`
- Risk: Medium
- Related epic: E2 — Catalog & Product Model
- Related ADRs: ADR 0001, ADR 0002

## Objective

Expose repository-agnostic public catalog read use cases and versioned HTTP routes with explicit safe DTOs and allow-listed query parameters.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` — API conventions/public catalog/security gates
- `docs/specifications/DATABASE_ERD.md` — Catalog
- `docs/specifications/SECURITY_ARCHITECTURE.md` — public DTO separation and input validation
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-postgresql-source-of-truth.md`

## Scope

- Catalog repository port validation and public list/detail use cases.
- Explicit Category, Brand, and ProductModel public DTO mappers.
- Active-only visibility enforced after repository reads.
- Allow-listed `categoryId`, `brandId`, `q`, `cursor`, `limit`, and `sort` query parameters.
- GET `/api/v1/categories`, `/api/v1/brands`, `/api/v1/product-models`, and `/api/v1/product-models/:id`.
- Standard `{data, meta?}` success and request-aware error envelopes.

## Non-scope

- PostgreSQL implementation/migration, admin writes, authentication, search index, specs expansion, caching, rate-limit backend, UI, and OpenAPI generation.

## Domain invariants affected

- Public DTOs cannot expose physical serial, cost, health, condition, or private evidence.
- Archived catalog records are not public.
- Repository remains replaceable; PostgreSQL will later become the implementation truth.

## Acceptance criteria

- [x] Public DTOs emit only approved catalog fields.
- [x] Archived records are filtered even if a repository returns them.
- [x] Unknown query parameters, invalid limits/sorts, and unsupported methods fail predictably.
- [x] Missing ProductModel returns 404 without exposing internals.
- [x] HTTP tests cover list/detail/meta/error and sensitive-field leakage.
- [x] Existing health behavior remains intact.

## State/API/schema/UI impact

Adds public GET routes and application contracts. No schema or UI impact.

## Security and privacy review

Responses are projection-based rather than model serialization. Query parameters are allow-listed, bounded, and passed as normalized filters. Errors exclude stack traces and repository details.

## Test plan

- Unit/application: DTO leak prevention, active-only visibility, repository contract.
- HTTP: routes, pagination meta, 400/404/405/500 envelopes, health regression.
- Full gate: `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No database migration, authentication policy, admin write, destructive delete, or production deployment.
