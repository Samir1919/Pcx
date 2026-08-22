# Agent Handoff: Media upload (local/NFS-backed, MEDIA_ROOT)

- Status: Complete
- Branch: `agent/web-sell-post-price-redirect`
- Latest commit: `86371b5`
- Date: 2026-08-22

## Outcome

A storage-agnostic media module now accepts image uploads and stores metadata + binary on a `MEDIA_ROOT`-driven local filesystem path (default `apps/api/uploads`). Seller photos, technician inspection evidence, and admin listing photos are all supported with server-generated keys, MIME allow-list, size limit, path-traversal guard, and public/private visibility access control.

## Changed areas

- `apps/api/migrations/0031_media.sql` — `media` + `sell_request_media`, `inspection_media`, `listing_media` link tables (additive).
- `apps/api/src/modules/media/local-media-storage.mjs` — `createLocalMediaStorage({ root })`; `MEDIA_ROOT` env-driven default via `DEFAULT_MEDIA_ROOT = process.cwd()/apps/api/uploads`; magic-byte MIME detection (JPEG/PNG/WebP), 5 MiB limit, server-generated UUID storage key.
- `apps/api/src/modules/media/postgres-media-repository.mjs` — metadata + link persistence.
- `apps/api/src/modules/media/media-service.mjs` — uploads with RBAC/ownership + public/private read guard.
- `apps/api/src/modules/media/media-http.mjs` — upload endpoints (`POST /api/v1/sell-requests/:id/media`, `/api/v1/inspections/:id/media`, `/api/v1/admin/listings/:id/media`) and public read `GET /api/v1/media/:id`.
- `apps/api/src/server.mjs`, `apps/api/src/modules/identity/auth-runtime.mjs` — routing + composition (mediaService) wiring.
- `apps/api/test/media-service.test.mjs` — storage + ownership tests.

## Acceptance criteria

- [x] Seller upload restricted to own sell request (IDOR guard).
- [x] Technician evidence-gated inspection upload (PRIVATE).
- [x] Admin listing photo upload (PUBLIC).
- [x] Non-image/oversize rejected; path traversal impossible (generated UUID keys).
- [x] Public read for PUBLIC media; PRIVATE read requires internal role.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | 487 pass, 0 fail, 23 skipped |
| verify:e0 / lint / typecheck / build / security | pass |
| `node scripts/live-verify.mjs admin-inventory` + `sell-flow` | PASS |

## Storage note (your TrueNAS/proxmox plan)

Set `MEDIA_ROOT=/mnt/pcx-media` (or the NFS mount path) to move files off local disk **without changing any code**. The default when the env var is absent is `<repo>/apps/api/uploads`.

## Remaining

S3/MinIO adapter swap, malware scan integration, and client-side upload pickers.

## Blockers requiring human decision

None.
