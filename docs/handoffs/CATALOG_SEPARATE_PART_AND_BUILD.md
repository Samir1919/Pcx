# Handoff: Catalog — separate single-part and full-PC-build models

- Objective: remove the half-implemented attribute-set drift, restore the
  approved per-category spec model, and add a separate full-PC build-create flow.
- Branch: `main` (working directly on main, matching repo history)
- Status: COMPLETE (all slices merged and verified).

## What changed

- Migration `0059_catalog_revert_attribute_sets.sql`: drops
  `attribute_sets`/`attribute_set_items`/`category_attribute_sets` and
  `sell_build_components.attribute_set_id`; restores per-category
  `spec_definitions` (`category_id` + `required` + `sort_order` +
  `UNIQUE(category_id, key)`); adds `product_models.model_kind` and
  `product_model_components`; transforms the seeded catalog in place (splits
  the remaining shared definitions socket/capacity_gb/screen_size_in, converts
  the two Desktop PC models to BUILD, links 11 component rows).
- Domain: `createSpecificationDefinition` requires `categoryId` (+ `required`,
  `sortOrder`); removed `createAttributeSet`/`createAttributeSetItem`/
  `attributeGroupLabel`; `createProductModel` accepts `modelKind` (default
  PART); `createSellBuildComponent` drops `attributeSetId`.
- Backend: catalog service/repo now expose `listCategoryDefinitionKeys`;
  spec-command service/repo/http drop all attribute-set endpoints and
  `listDefinitions({categoryId})` is a direct per-category query; sell-taxonomy
  service/repos drop `attributeSetId` and expose `getComponentCategory`;
  sell-request build spec scoping uses the component category's definition keys.
- Admin UI: removed the Attribute sets tab/panel and the attribute-set dropdown
  in the acquisition Sell flow; the Attributes (definitions) create form now
  requires a category + optional required/sortOrder.
- Tests updated (domain, spec-command service, sell-request, migrations,
  catalog-seed-volume, catalog-spec-command-repository, catalog-repository).

## Acceptance criteria status

- [x] attribute-set tables/columns gone; per-category specs work end-to-end.
- [x] separate build-create flow (existing + inline-new) works end-to-end.
- [x] `npm run verify` (lint, typecheck, test, build, security, ui-guard, verify:e0) all pass.
- [x] `npm test` with TEST_DATABASE_URL: 735 pass.
- [x] Headed-browser evidence: `docs/verify/browser-verify.json` (passed).

## Decisions / ADRs

- ADR 0017 (Accepted): separate single-part and full-PC-build catalog models.

## Migration / rollback

- `0059_catalog_revert_attribute_sets.sql` is destructive (DROP TABLE/COLUMN),
  dev/staging only, authorized by the human via ADR 0017. Applied to `pcx_test`
  and `pcx` dev DBs; verified counts: 33 defs, 102 values, 11 components, 2 builds.

## Commits

- `db90d58` revert attribute sets, restore per-category specs + build schema
- `af56e94` full-PC build create flow + storefront component summary
- `c4fad4d` fix optional build slots and record headed browser evidence

## Next safe tasks

- None required for this epic. Optional polish: build edit/delete in the admin;
  build listing filters on the storefront.
