# Agent Handoff: Media upload UI + browser verification

- Status: Complete
- Branch: `agent/web-sell-post-price-redirect`
- Latest commit: `098ea7b`
- Date: 2026-08-22

## Outcome

Three media-upload surfaces now exist, each targeting the right actor, with multiple-file support and browser verification:

1. **Admin listing photos** — `apps/admin/app/(workspace)/listings/page.js` Actions now show a "Photos" button opening a `ListingMediaModal` (`media-modal.js`). File picker accepts multiple JPEG/PNG/WebP, shows previews and previously uploaded images, and uploads to `POST /api/v1/admin/listings/:id/media` (PUBLIC).
2. **Sell-request photos** — `apps/web/app/sell/page.js` request step now has "Item photos" (multiple) with preview; uploaded immediately after `createSellRequest` to `POST /api/v1/sell-requests/:id/media` (PRIVATE, seller-owned).
3. **Inspection evidence** — `apps/admin/app/(workspace)/inventory/inspection-modal.js` now shows an "Evidence" file input uploading to `POST /api/v1/inspections/:id/media` (PRIVATE, technician-gated).

## Backend additions since the first media slice

- `media-http.mjs` — list endpoints for the same paths (`GET .../media`) and public `GET /api/v1/media/:id`.
- `postgres-media-repository.mjs` / `media-service.mjs` — `listInspectionMedia`/`listListingMedia` and `listSellRequestMedia` (ownership-guarded).

## Changed areas

- `apps/admin/lib/listing-api.js`, `apps/admin/lib/ops-api.js` — binary upload helpers (CSRF + octet-stream).
- `apps/web/lib/storefront-api.js` — `uploadSellRequestMedia` via `uploadBinary`.
- `apps/admin/app/globals.css`, `apps/web/app/globals.css` — `.mediaGrid`.

## Verification

| Command/check | Result |
|---|---|
| `npm test` | 487 pass, 0 fail, 23 skipped |
| verify:e0 / lint / typecheck / build / security | pass |
| `node scripts/live-verify.mjs admin-inventory` | PASS |
| `node scripts/live-verify.mjs sell-flow` | PASS |
| `node scripts/live-verify.mjs admin-listing-photos` | PASS |

## Remaining

Malware scan integration and S3/MinIO swap (when you move to TrueNAS/proxmox, set `MEDIA_ROOT=/mnt/pcx-media`).

## Blockers requiring human decision

None.
