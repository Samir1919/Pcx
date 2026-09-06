# Task: Catalog — separate single-part and full-PC-build models

- Status: In progress
- Owner/agent: Cline
- Branch: `main` (working slice; feature branch if required by merge gate)
- Risk: High (destructive migration)
- Related epic: E2 — Catalog & Product Model
- Related ADRs: 0017

## Objective

Remove the half-implemented attribute-set drift and give the catalog two
distinct, clean flows: single-part creation (one ProductModel + its category's
per-category specs) and full-PC-build creation (a composite ProductModel that
references component parts, with inline new-part creation).

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` §4 CATALOG
- `docs/adr/0017-separate-part-and-build-catalog.md`

## Scope

- Revert `spec_definitions` to per-category (category_id + required + sort_order + UNIQUE(category_id,key)).
- Drop attribute_sets / attribute_set_items / category_attribute_sets and sell_build_components.attribute_set_id.
- Add product_models.model_kind and product_model_components.
- Separate admin single-part create vs build create (build = select-existing or inline-new part per slot, atomic save).
- Update sell-request build spec scoping to category-scoped definitions.

## Non-scope

- Pricing, inventory serial/grade/health, storefront build configurator for buyers (future PC builder).
- Nested builds (build within a build).

## Domain invariants affected

- ProductModel vs InventoryItem stay separate; a build is still one ProductModel → one physical lifecycle identity.

## Acceptance criteria

- [ ] attribute-set tables/columns gone; per-category specs work end-to-end.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run verify` pass.

## Test plan

- Unit: domain catalog-specifications, catalog-spec-command-service, sell-request-service.
- Integration: migrations, catalog-seed-volume, catalog-spec-command-repository.

## Migration and rollback

`0059_catalog_revert_attribute_sets.sql` — destructive; dev/staging only.
