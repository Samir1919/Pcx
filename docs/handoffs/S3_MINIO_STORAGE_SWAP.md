# S3/MinIO object-storage swap (2026-09-01)

Swapped media storage from local disk to MinIO (self-hosted S3-compatible),
activated purely by the already-present `OBJECT_STORAGE_*` env vars.

## Changed areas

- `apps/api/src/modules/media/image-processing.mjs` (new) — shared upload policy:
  MIME allow-list, size limits, WebP re-encode + thumbnail (single source of
  truth for both adapters).
- `apps/api/src/modules/media/local-media-storage.mjs` — refactored to reuse
  `prepareImage` from `image-processing.mjs`; behavior unchanged (existing tests
  still pass).
- `apps/api/src/modules/media/s3-media-storage.mjs` (new) — `minio`-client adapter
  behind the same `save/read/readThumb/promote` interface; lazy idempotent bucket
  auto-create; `createS3MediaStorageFromEnv` reads `OBJECT_STORAGE_*`.
- `apps/api/src/modules/identity/auth-runtime.mjs` — `createS3MediaStorageFromEnv()
  ?? createLocalMediaStorage()`.
- `apps/api/package.json` + `package-lock.json` — added `minio@8.0.7`.
- `infra/docker-compose.yml` — api service sets `OBJECT_STORAGE_*` → `http://minio:9000`.
- Tests: `s3-media-storage.test.mjs` (unit, mock client) +
  `integration/s3-media-storage.test.mjs` (real MinIO round-trip).

## How to activate / deactivate

- Present `OBJECT_STORAGE_ENDPOINT` (+ bucket/access/secret) → MinIO.
- Absent → local disk (`apps/api/uploads`), unchanged behavior.

## Verification

- `npm run lint`, `npm run typecheck` pass.
- `npm test` with DB: 644/646 (2 pre-existing shared-DB pollution failures).
- Headed browser: admin listing Photos upload → object observed in the
  `pcx-local` MinIO bucket (`public/<key>` + `<key>_thumb`), local `uploads`
  dir untouched. `npm run ui-guard` passes.

## Notes / migration

- Dev-only media on the old local disk are NOT auto-migrated to MinIO; a fresh
  `seed:demo` (which creates no media binaries) + re-upload is the path. A
  production migration would copy `apps/api/uploads/*` → the bucket.
- Real ClamAV gate at the object-storage level is the remaining E19 item.
