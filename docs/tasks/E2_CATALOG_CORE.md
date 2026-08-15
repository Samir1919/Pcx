# Task: E2 Catalog Core Contracts

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e2-catalog-core`
- Risk: Medium
- Related epic: E2 — Catalog & Product Model
- Related ADRs: ADR 0001, ADR 0002

## Objective

Establish framework-neutral Category, Brand, and ProductModel contracts with safe archive behavior and an enforced boundary that prevents physical-item facts from entering ProductModel.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`
- `docs/specifications/USER_FLOW_SCREEN_MAP.md` — Admin Catalog flow
- `docs/specifications/DATABASE_ERD.md` — Catalog
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` — Admin Catalog API
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-postgresql-source-of-truth.md`

## Scope

- Catalog lifecycle status and immutable Category, Brand, and ProductModel records.
- Canonical slug, name, model code, parent/category/brand references, sort order, and search aliases.
- Explicit rejection of serial-, condition-, health-, acquisition-cost-, price-, and warranty-level fields in ProductModel input.
- Archive transition that preserves record identity and history.

## Non-scope

- Persistence/migrations, admin HTTP CRUD, category spec definitions/values, search index, inventory, media, inspection templates, UI, and destructive delete.

## Domain invariants affected

- `ProductModel` remains generic catalog identity and cannot contain physical unit facts.
- Historical catalog records are archived, not destructively deleted.
- Server/domain rules own status and lifecycle transitions.

## Acceptance criteria

- [x] Category, Brand, and ProductModel factories return validated immutable records.
- [x] Slugs use canonical lowercase URL-safe form and aliases are normalized/deduplicated.
- [x] ProductModel requires category and brand identity.
- [x] Physical-item and commercial-sensitive fields are rejected from ProductModel input.
- [x] Archive is an explicit idempotent transition preserving identity and created timestamp.
- [x] Tests cover validation, normalization, sensitive-field separation, and archive behavior.

## State/API/schema/UI impact

Domain contracts only. No HTTP, schema, or UI changes.

## Security and privacy review

Rejecting physical-item facts at the domain boundary reduces serial, cost, and health-data leakage into public catalog DTOs. Persistence and API layers must later repeat allow-list validation and authorization.

## Test plan

- Unit: factories, normalization, forbidden fields, archive transition.
- Integration: deferred to additive catalog persistence slice.
- Full gate: `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No destructive deletion, schema migration, inventory representation, or core identity-boundary change.
