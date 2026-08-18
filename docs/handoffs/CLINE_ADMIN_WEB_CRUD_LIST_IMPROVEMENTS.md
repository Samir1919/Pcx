# Admin CRUD & Read-only List Improvements

## Objective

Close admin UI CRUD/read gaps:
1. Replace `window.prompt` catalog edits with full typed edit modals.
2. Surface existing/approved backend read endpoints in admin workspaces.
3. Add read-only admin list endpoints where action-only workspaces were blind.

## Branch & commits

- Branch: `agent/admin-web-crud-list-improvements`
- `533821a` feat(admin): replace catalog window.prompt edits with typed edit modal
- `4914983` feat(admin): inventory item detail view via existing endpoint
- `288b883` feat(admin): notifications read-only list endpoint and table
- `8b56daf` feat(admin): shipment read-only list endpoint and table
- `51de7cd` feat(admin): returns read-only list endpoint and table
- `21d58fc` feat(admin): warranty and claims read-only list endpoints and tables
- `2335515` feat(admin): read-only sell-request admin queue

## Files changed (core)

- `apps/admin/app/(workspace)/catalog/workspace.js` — `CatalogEditModal` (createPortal) replaces `window.prompt`; full-field edits for categories/brands/models/definitions; key/dataType immutable (read-only).
- `apps/admin/app/globals.css` — `.readonlyField`, `.detailList`, modal `select` width.
- `apps/admin/app/(workspace)/inventory/page.js` + `lib/ops-api.js` — inventory item detail modal via existing `GET /admin/inventory/:id`.
- `apps/admin/app/(workspace)/notifications/page.js` + backend service/repo/http + lib/test — `GET /admin/notifications`.
- `apps/admin/app/(workspace)/shipment/page.js` + backend service/repo/http + lib/test — `GET /admin/shipments`.
- `apps/admin/app/(workspace)/returns/page.js` + backend service/repo/http + lib/test — `GET /returns`.
- `apps/admin/app/(workspace)/warranty/page.js` + backend service/repo/http + lib/test — `GET /admin/warranties`, `GET /admin/claims`.
- `apps/admin/app/(workspace)/acquisition/page.js` + backend sell-request service/repo/http + lib/test — `GET /admin/sell-requests`.

## Acceptance criteria status

- [x] Catalog edit uses a modal and edits all server-supported fields.
- [x] Acquisition workspace shows sell requests.
- [x] Inventory item detail is reachable.
- [x] Shipment/return/warranty/notification workspaces show read-only lists.
- [x] `npm run verify` passes; no `window.prompt` remains.

## Commands & results

- `npm test`: 417 tests, 395 pass, 0 fail, 22 skipped (DB integration).
- `npm run verify`: pass (E0, lint, typecheck, test, build, security).

## Security review

- New read endpoints gated by existing RBAC (SYSTEM_CONFIGURE/AUDIT_READ/REFUND_MANAGE/INVENTORY_MANAGE/PRICING_MANAGE).
- No serial/cost/private evidence exposed; no client-owned status/price.
- No schema change; no migration.

## Non-scope / deferred

- Free CRUD on server-owned lifecycle records (listings, shipments, returns, warranty claims, acquisition payments) remains prohibited by invariants.
- Web passport grade/specifications (E7 disclosure completeness) and E5 inspection results remain deferred scope.

## Blockers

None.
