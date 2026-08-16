# Task: E2 Catalog Seeds and Volume Validation

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-catalog-seeds`
- Risk: Low
- Related epic: E2
- Related ADRs: ADR 0002

## Objective

Provide idempotent launch-aligned catalog seed fixtures and validate public query pagination/index plans at realistic synthetic volume.

## Scope

- P1–P3 launch categories, recognizable brands/models, typed definitions/values.
- Idempotent additive seed migration.
- Seed integrity and sensitive-column absence checks.
- Synthetic-volume pagination/search and EXPLAIN index-plan validation.

## Non-scope

- Inventory/listings/prices, exhaustive commercial catalog, production migration, UI.

## Acceptance criteria

- [x] Every approved launch category has active seed representation.
- [x] Seed models remain generic and typed values align with definitions.
- [x] Migration is repeatable without duplicates.
- [x] Public cursor/search works over realistic synthetic volume.
- [x] Indexed public ordering avoids a sequential product-model scan.

## Migration and rollback

Additive `0006_catalog_seed.sql`; destructive production rollback prohibited.

## Prohibited changes / hard stops

No physical serial, condition, health, cost, price, warranty, production deployment, or destructive seed replacement.
