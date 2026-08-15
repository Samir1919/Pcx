# Task: E2 PostgreSQL Catalog Persistence

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-catalog-persistence`
- Risk: Medium
- Related epic: E2
- Related ADRs: ADR 0002

## Objective

Add constrained PostgreSQL catalog/specification schema and a production-shaped public read repository for the existing catalog service.

## Scope

- Additive category, brand, product-model, specification-definition, and typed-value tables.
- Database constraints preserving generic-model/physical-item separation and category/type alignment.
- Active public category/brand/model list/detail reads with allow-listed filters, deterministic cursor pagination, and search.
- Runtime catalog service composition.

## Non-scope

- Admin writes/archive API, seed volume, listings/prices/inventory, search engine, UI.

## Domain invariants affected

- ProductModel contains no serial, grade, health, acquisition cost, price, or warranty fields.
- Specification values must share both category and declared type with their definition/model.
- Archive is status/timestamp based; no destructive catalog deletion flow is added.

## Acceptance criteria

- [x] Migration is additive/repeatable with slug, parent, status, and typed-value constraints.
- [x] Cross-category or type-mismatched specification values fail at the database boundary.
- [x] Public repository returns active safe model records with deterministic pagination.
- [x] Filters/search are parameterized and cursor input fails closed.
- [x] Runtime composes the public catalog service from PostgreSQL.

## Security and test plan

Parameterized SQL, sensitive-column absence inspection, migration constraint tests, public repository integration, full `verify:ci`.

## Migration and rollback

Additive `0004_catalog.sql`. Destructive production rollback is prohibited.

## Prohibited changes / hard stops

No serial/cost/price/health/warranty model fields, production migration, destructive delete, or unauthorized admin write.
