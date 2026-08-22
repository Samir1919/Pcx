# Task: E2 Typed Catalog Specifications

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e2-catalog-specifications`
- Risk: Medium
- Related epic: E2 — Catalog & Product Model
- Related ADRs: ADR 0001, ADR 0002

## Objective

Define category-owned specification definitions and type-safe ProductModel specification values, including category matching and duplicate-definition prevention.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` — `spec_definitions`, `model_spec_values`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md` — category-specific specifications
- `docs/specifications/USER_FLOW_SCREEN_MAP.md` — define category attributes/model specs
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-postgresql-source-of-truth.md`

## Scope

- TEXT, NUMBER, BOOLEAN, and JSON specification data types.
- Immutable specification definitions with key, label, optional unit, filterability, required flag, and sort order.
- Immutable typed values linked to ProductModel and definition.
- Category-consistency validation and duplicate-definition rejection for a model value set.
- JSON-safe cloning/freezing so caller mutation cannot change stored domain facts.

## Non-scope

- Persistence/migration, category/model lookup repository, admin HTTP/UI, search indexing/filter execution, bulk import, and InventoryItem values.

## Domain invariants affected

- Specifications describe generic ProductModel facts only; physical-item facts remain outside this module.
- Model values must use definitions belonging to the same category.
- Persistence uniqueness is anticipated by a domain duplicate guard and later database constraint.

## Acceptance criteria

- [x] Definitions validate canonical keys, supported types, flags, units, and sort order.
- [x] Values enforce their definition's type.
- [x] Definition and ProductModel category IDs must match.
- [x] A ProductModel value set rejects duplicate definition IDs and mixed model IDs.
- [x] JSON values are JSON-safe, cloned, and deeply immutable.
- [x] Unit/full tests cover success and denial paths.

## State/API/schema/UI impact

Domain contracts only.

## Security and privacy review

Inputs are untrusted at future API boundaries. This slice uses explicit fields, strict type checks, canonical keys, JSON serialization validation, and immutable outputs. Limits on JSON depth/size remain an API validation concern and are deferred.

## Test plan

- Unit: definition validation, each type, mismatches, duplicates, JSON mutation resistance.
- Full gate: `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No database migration, physical-item attribute storage, destructive delete, or source-of-truth change.
