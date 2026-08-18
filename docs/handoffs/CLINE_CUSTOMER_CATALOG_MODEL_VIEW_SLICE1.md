# Customer Catalog: Product Model Spec View + Full-PC/Part Specs (Slice 1)

## Scope
Enable a customer to see a ProductModel's typed specifications (full Desktop PC components and part-level specs) through a public model detail page. This is the first of three slices addressing the missing core storefront flows.

## Acceptance criteria
- Desktop PC category has spec definitions for cpu, gpu, ram_gb, storage, psu_wattage, motherboard.
- CPU/Motherboard/RAM/Storage categories have deeper part-level specs (cores, threads, clock, chipset, form factor, speed, type, storage type).
- Seeded PCX Gaming Tower carries its component spec values; seeded parts carry their own values.
- Customer can open `/model/[id]` and see a typed specifications table.
- Passport page links to the model specification page.

## Changed files
- `apps/api/migrations/0022_catalog_desktop_pc_specs.sql` (additive; fixed UUIDs + ON CONFLICT DO NOTHING)
- `apps/web/lib/storefront-api.js` (added `productModel(id)`)
- `apps/web/app/model/[id]/page.js` (new)
- `apps/web/app/passport/[pcxId]/page.js` (link to model specs)
- `apps/web/app/globals.css` (spec table + model page styles)

## Verification
- `npm run lint` pass
- `npm run typecheck` pass
- `npm run build -w @pcx/web` pass; route `/model/[id]` registered
- `npm test`: 417 total, 395 pass, 0 fail, 22 skipped (DB integration)
- Migration applied locally; live query confirms Desktop PC spec definitions and PCX Gaming Tower component values present.
- Public catalog read path already returns typed `value` per spec (TEXT/NUMBER/BOOLEAN/JSON); model page consumes it correctly.

## Decisions / ADRs
- No ADR needed: uses existing catalog spec_definitions/model_spec_values tables and public `/api/v1/product-models/:id` surface. No new table.
- Full PC is a single ProductModel whose components are structured spec values; no PC Builder/compatibility engine (that remains post-MVP per `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md` §23).

## Branch / commit
- Branch: `agent/customer-catalog-model-view-sell-quote`
- Commit: `f5351da` Add customer product-model spec view and desktop/part catalog specs
- Commit (Slice 3a): sell-request selected-specs capture (structural)

## Slice 3a — Sell-request spec/select capture (structural part, committed)
- Migration `0023_sell_request_selected_specs.sql` adds `sell_requests.selected_specs jsonb NOT NULL DEFAULT '[]'`.
- Domain `createSellRequest` now accepts `selectedSpecs` (array of `{key, value}` scalar, frozen); invalid/non-scalar values rejected.
- Service `createFields` allowlists `selectedSpecs`; repository INSERT/SELECT/row mapping persist it.
- Tests added in `sell-request-service.test.mjs` (capture + non-scalar rejection); `catalog-seed-volume.test.mjs` seed-count assertions updated 8→23 spec definitions and 9→33 model spec values to reflect the legitimate catalog enrichment.

## Verification (Slice 3a)
- `npm run typecheck` pass, `npm run lint` pass.
- `node --test apps/api/test/sell-request-service.test.mjs` 5/5 pass.
- `node --test apps/api/test/integration/catalog-seed-volume.test.mjs` 1/1 pass.
- Migration 0023 applied live; `information_schema` confirms `sell_requests.selected_specs jsonb` default `'[]'`.

## Known pre-existing/environment test failures (not caused by this slice)
With `TEST_DATABASE_URL` now set locally, previously-skipped DB/unit tests run and surface 4 failures unrelated to catalog/sell-request:
1. `auth-http` "login issues secure scoped cookies" — `NODE_ENV=development` drops `Secure` attribute, but the test expects it unconditionally.
2. `deepseek executor keeps json_object` — external AI adapter behavior.
3. `listing repository persists draft...` (integration) — listing table untouched by these migrations.
4. `identity migration is repeatable...` (integration) — identity migrations untouched.

## Remaining work (dependency-ready)
1. **Slice 2 — Storefront buy path (customer can actually purchase).**
   - Storefront listing card + passport need "Buy Now / Reserve" using customer-gated reservation endpoints (`POST /api/v1/reservations`, `GET /api/v1/reservations/:inventoryItemId/active`, `POST /api/v1/reservations/:id/convert`), then order/payment (`POST /api/v1/orders`, payment init/confirm).
   - Requires a customer authentication/session flow in `apps/web` (login + CSRF cookie). Backend commerce routes are customer-gated and CSRF-protected.
   - Cart persistence is post-MVP; MVP needs at least a single-item Buy Now path.
2. **Slice 3 — Sell-to-PCX spec/variant select + estimated quote.**
   - Sell request currently captures only `productModelId` (no selected specs). Add `selected_specs` capture to the sell-request aggregate (`packages/domain/src/acquisition/sell-request.mjs`), service, HTTP, repository, and a migration column.
   - Produce a rule-based preliminary estimated range (low/high + disclaimer "Estimated ≠ Final Offer") surfacing on the sell flow; `packages/domain/src/acquisition/valuation-offer.mjs` already models valuation immutability.

## Risks / notes
- Slice 2 must never let client input author price/totals; order totals are server-computed already (`order-payment-service.mjs`).
- Slice 3 must keep estimated range strictly non-authoritative; final offer stays server-owned.
- `PROJECT_STATUS.md` update should be applied at merge time (E2/E8 verified scope + main evidence commit), not on this feature branch.
