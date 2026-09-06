# Handoff: Catalog — separate single-part and full-PC-build models (slice 1)

- Objective: remove the half-implemented attribute-set drift and restore the
  approved per-category spec model, plus introduce the composite-build schema.
- Branch: `main` (working directly on main, matching repo history)
- Status: Slice 1 complete and verified (see below). Build-create flow (slice 2+) pending.

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
- [x] `npm run lint`, `npm run typecheck`, `npm test` (732 pass), `npm run verify:e0` pass.
- [ ] `npm run build` / `npm run verify` — BLOCKED by a pre-existing admin
      `/_global-error` prerender error (`Cannot read properties of null
      (reading 'useContext')`), reproduced at HEAD with this slice's changes
      stashed. Unrelated to this slice; needs a separate fix in the admin
      error boundary.

## Decisions / ADRs

- ADR 0017 (Accepted): separate single-part and full-PC-build catalog models.

## Migration / rollback

- `0059_catalog_revert_attribute_sets.sql` is destructive (DROP TABLE/COLUMN),
  dev/staging only, authorized by the human via ADR 0017. Applied to `pcx_test`
  and `pcx` dev DBs; verified counts: 33 defs, 102 values, 11 components, 2 builds.

## Next safe tasks

1. Backend atomic build-create command/service/repo/HTTP
   (`POST /api/v1/admin/product-model-builds`).
2. Admin build-create page (component slots with select-existing OR inline-new).
3. Build detail + storefront component summary (server-owned, read-only).
4. Final `npm run verify` + headed-browser evidence + merge-gate.
