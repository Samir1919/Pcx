# Agent Handoff: Admin UI — Listing Management

- Status: Complete
- Branch: agent/admin-ui-listing
- Latest commit: 098b56e
- Date: 2026-08-18

## Outcome

Admin panel-এ now একটি Listing workspace আছে। ADMIN/PRICING_MANAGE role
এর একজন user এখন তালিকা দেখতে, draft তৈরি, publish এবং দাম সেট করতে পারে।
Backend-এ missing admin list endpoint যুক্ত হয়েছে যাতে listings manage করার আগে দেখা যায়।

## Changed areas

- `apps/api/src/modules/listing/postgres-listing-repository.mjs` — `listAdmin(query)`
  যোগ হয়েছে (model name + current price সহ, pagination meta ফেরত দেয়)।
- `apps/api/src/modules/listing/listing-service.mjs` — `listAdmin` service method,
  PRICING_READ gate, snake→camel DTO mapping।
- `apps/api/src/modules/listing/listing-http.mjs` — `GET /api/v1/admin/listings`
  route (same-origin read, authz service-এ)।
- `apps/admin/lib/listing-api.js` — নতুন client (list/createDraft/publish/setPrice)।
- `apps/admin/app/(workspace)/listings/page.js` — Listing workspace UI।
- `apps/admin/app/user-shell.js` — "Listings" nav entry + icon।
- Tests updated: listing-service, listing-http, listing repository integration,
  এবং নতুন admin listing-api test।

## Acceptance criteria

- [x] `GET /api/v1/admin/listings` returns listings with model name + current price (integration + HTTP test)।
- [x] Admin UI lists listings and can create draft, publish, and set price (UI + client test)।
- [x] Publish uses server-owned transition; UI surfaces server error (HTTP invalid_state→409 test)।
- [x] Tests pass; no client-owned status/price authority (client test asserts no `status` sent)।

## Verification

| Command/test | Result |
|---|---|
| `node --test listing-service listing-http listing-api` | Pass (13/13) |
| `npm run verify` | Pass (375 pass, 0 fail, 22 skipped) |

## Architecture/security review

- Writes keep existing PRICING_MANAGE + Origin + CSRF double-submit gate (unchanged)।
- Reads use PRICING_READ (new `reader` helper)।
- Admin list exposes only model name, status, price, slugs, pcx id — no serial,
  acquisition cost, or private evidence। Listing status remains server-owned
  (DRAFT→PUBLISHED only via `publishListing`)।

## Schema/configuration/deployment

None. No migrations, no env changes।

## Remaining work and next safe action

- Slice 2: `admin-ui-inventory-intake` (inventory intake form on Inventory page)।
- Slice 3: `admin-ui-inspection-create`।
- Slice 4: `admin-ui-acquisition`।
- Slice 5: `admin-ui-shipment`।
- Slice 6: `admin-ui-return`।
- Slice 7: `admin-ui-warranty`।
- Slice 8: `admin-ui-notifications`।

## Blockers requiring human decision

None।
