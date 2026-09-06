# ADR 0017: Separate single-part and full-PC-build catalog models

- Status: Accepted
- Date: 2026-09-06

## Context

The admin catalog's ProductModel create form tried to model two different
concepts through one form: a single part (GPU, CPU, RAM, …) with its own specs,
and a full PC build (Desktop PC) that is really a composition of parts. Forcing
both through one flat ProductModel — with `cpu`, `ram_gb`, `storage_gb`, `gpu`,
`psu_wattage` as flat spec values on a single "Desktop PC" model — produced the
mess.

To solve it, a global-attribute + attribute-set model (Magento-style) was
introduced in migrations `0052–0058`. It replaced the approved per-category
`spec_definitions` (category_id + required + sort_order, `UNIQUE(category_id,
key)`) with globally-unique definitions assigned to categories/build roles via
reusable attribute sets. This drifted from the approved `DATABASE_ERD` (v1.0,
section 4 CATALOG) and could not be fully implemented: shared keys changed
meaning across components (RAM `memory_type` DDR4 vs GPU `memory_type` GDDR6,
motherboard `chipset` vs GPU chip, form factor ATX vs drive form factor), which
required a chain of corrective migrations (`0056–0058`).

## Decision

1. **Revert the catalog to the approved per-category spec model.** Drop the
   `attribute_sets`, `attribute_set_items`, and `category_attribute_sets`
   tables and `sell_build_components.attribute_set_id`. Restore
   `spec_definitions.category_id` (with `required` and `sort_order`) and
   `UNIQUE(category_id, key)`. A single ProductModel is one part with its
   category's specs.

2. **Model a full PC build as a composite ProductModel.** Add
   `product_models.model_kind` (`PART` | `BUILD`) and a new
   `product_model_components` join table (build → component part + quantity).
   A build is still a `ProductModel`, so the `ProductModel 1→N InventoryItem`
   invariant holds: one physical PC is one inventory unit with one lifecycle
   identity; its components are descriptive references, never separate
   inventory items.

3. **Separate admin flows.** Single-part creation stays one simple form; build
   creation becomes a dedicated flow where each component slot can either
   select an existing part ProductModel or create a new part inline (which is
   saved atomically as a ProductModel and linked into the build).

## Consequences

- Migration `0059_catalog_revert_attribute_sets.sql` drops the attribute-set
  tables and the `attribute_set_id` column, restores per-category
  `spec_definitions`, adds `model_kind` + `product_model_components`, and
  transforms the seeded catalog data in place (splits the remaining shared
  definitions, converts the two Desktop PC models to BUILD, links components).
- The catalog domain/service/repository and the admin catalog UI drop the
  attribute-set manager and return to category-scoped definitions.
- Sell-request build spec scoping resolves the component category's definitions
  directly (no attribute set).
- This is a domain/source-of-truth change and a destructive migration
  (`DROP TABLE` / `DROP COLUMN`), so it required explicit human approval as a
  hard stop.

## Approval

Approved by the user on 2026-09-06 as part of the "separate single-product and
full-PC-build systems, clean up irrelevant code and DB" request. This approval
authorizes the destructive migration in development/staging only; it does not
authorize production deployment.
