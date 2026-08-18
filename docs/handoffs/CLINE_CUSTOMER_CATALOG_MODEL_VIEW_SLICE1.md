# Customer Storefront: Model Spec View, Buy Path, and Sell-to-PCX Quote

## Scope
Close the missing "fundamental core" customer flows: (1) typed ProductModel specification view, (2) the ability for a signed-in customer to actually buy a published item, and (3) a Sell-to-PCX flow that captures the selected model specs and surfaces an estimated (non-final) price range.

## Acceptance criteria
- Desktop PC category has component spec definitions (cpu, gpu, ram_gb, storage, psu_wattage, motherboard) and seeded part-level specs.
- Customer can open `/model/[id]` and see a typed specification table; passport links to it.
- A signed-in customer can open a published passport, reserve the item, create a server-priced order, initiate and confirm payment (sandbox gateway). Public listing/passport expose `inventoryItemId`/`listingId` needed for the buy path but never serials/cost/private evidence.
- Sell flows: `/sell` shows category → brand → model → catalog specs → contact/declaration; creates a sell request with `selectedSpecs` and returns a placeholder estimated range with an explicit "not a final offer" disclaimer.

## Changed files
- `apps/api/migrations/0022_catalog_desktop_pc_specs.sql` (additive catalog spec enrichment)
- `apps/api/migrations/0023_sell_request_selected_specs.sql` (`sell_requests.selected_specs jsonb`)
- `packages/domain/src/listing/listing.mjs` (+`inventoryItemId`/`listingId` on public listing/passport)
- `packages/domain/src/acquisition/sell-request.mjs` (+`selectedSpecs` validation)
- `apps/api/src/modules/listing/listing-service.mjs` + `postgres-listing-repository.mjs` (project buy identifiers)
- `apps/api/src/modules/commerce/order-payment-http.mjs` (add missing `POST /api/v1/payments` create route)
- `apps/api/src/modules/acquisition/sell-request-service.mjs` (selectedSpecs + placeholder estimated range)
- `apps/web/lib/storefront-api.js` (login/me/reserve/order/payment/sell-request + productModels)
- `apps/web/app/model/[id]/page.js` (new typed model spec page)
- `apps/web/app/passport/BuyFlow.js` (new buy flow: login → reserve → order → pay)
- `apps/web/app/sell/page.js` (new Sell-to-PCX flow)
- `apps/web/app/storefront/workspace.js` + `apps/web/app/passport/[pcxId]/page.js` (nav/CTA + buy wiring)
- `apps/web/app/globals.css` (spec table, buy box, sell form styles)
- Tests updated/added: `packages/domain/test/listing.test.mjs`, `apps/api/test/listing-service.test.mjs`, `apps/api/test/sell-request-service.test.mjs`, `apps/web/test/storefront-api.test.mjs`, `apps/api/test/integration/catalog-seed-volume.test.mjs`

## Verification (clean unit environment)
- `npm run lint` pass
- `npm run typecheck` pass
- `npm run build` pass (`Application boundaries load successfully`)
- `npm run build -w @pcx/web` pass with `NODE_ENV=production` (see environmental note below)
- `node --test apps/api/test/sell-request-service.test.mjs` 6/6 pass
- `node --test apps/api/test/listing-service.test.mjs apps/api/test/listing-http.test.mjs` 12/12 pass
- `node --test apps/api/test/order-payment-service.test.mjs ... reservation-*` 16/16 pass
- Full unit (`env -u TEST_DATABASE_URL -u NODE_ENV -u DEEPSEEK_API_KEY -u OPENAI_API_KEY npm test`): 420 total, 397 pass, 22 skipped, 1 fail (see below)

## Decisions / ADRs
- `inventoryItemId` and `listingId` on the public listing/passport are safe disclosure: they are the commerce identifiers the reservation/order APIs already expect, and unlike serials/cost they are not private evidence. No ADR needed.
- Estimated sell range is a documented PLACEHOLDER rule-engine interface (per approved backlog E3 "estimated-range placeholder/rule engine interface"), not a pricing policy. No final offer is generated client-side; final offers remain server-owned via the acquisition valuation/offer module.

## Branch / commits (agent/customer-catalog-model-view-sell-quote)
- `f5351da` Add customer product-model spec view and desktop/part catalog specs
- `f2e847c` Add Slice 1 handoff: customer product-model spec view
- `e921e58` Capture seller-declared specs on sell requests
- `f5e6f08` Expose buy identifiers on public listing/passport and add payment route
- `e5c47e8` Add customer storefront buy flow with login reserve order payment
- `fbffa31` Add sell-to-pcx spec select estimated range and customer sell flow UI

## Known non-blocking failures (pre-existing/environmental, NOT caused by these slices)
1. `scripts/ai-adapters.test.mjs` "deepseek executor keeps json_object..." — external AI adapter behavior; fails even with `DEEPSEEK_API_KEY` unset and is unrelated to catalog/commerce/web. (This is the only failing test in a clean unit run.)
2. `apps/web` Next.js build prerender of `/`/`_global-error` fails with `Cannot read properties of null (reading 'useContext')` when `NODE_ENV=development` is exported from repo `.env`; it passes with `NODE_ENV=production`. Environmental, not source.
3. DB integration tests (`listing-repository`, `identity-migration`) fail when pointed at the shared dev DB due to leftover test rows/count pollution; they are `skip`ped by default unless `TEST_DATABASE_URL` is set. `catalog-seed-volume` was updated and passes against the migrated DB.

## Remaining work (dependency-ready)
- Cart persistence across sessions (spec: post-MVP; Buy Now single-item path is implemented).
- Real bKash HTTP adapter/webhook + refunds (already tracked in `PROJECT_STATUS.md` next-dependency list).
- Final-offer/accept/reject customer timeline UI (backend valuation/offer flow exists; admin UI exists).

## Status update note
`docs/status/PROJECT_STATUS.md` should be updated at merge time to record E2/E3/E8/E9/E10 verified scope and the merge commit. This feature branch intentionally does not rewrite the central index.

## Risks / notes
- Buy flow never lets client input author price/totals (order service computes totals server-side; payment transaction id is gateway-derived).
- Sell flow estimated range keeps the "Estimated ≠ Final Offer" invariant; final offer stays server-owned.
- Do not merge without running `npm run verify:ci` in CI (integration suite) and confirming the AI-adapter test environment.
