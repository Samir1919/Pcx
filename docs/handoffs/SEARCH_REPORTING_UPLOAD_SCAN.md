# Search index, reporting & audit, and upload scanning (2026-09-01)

Three bounded slices completed in one run. All are committed, pushed, and merged
to `origin/main` (`74d5db2` latest). No hard stops were crossed.

## Slice 1 — Dedicated search index + related listings (E7/E8)

- Migration `0044_listing_search_index.sql`: weighted `tsvector` generated column
  (`search_vector`) on `product_models` backed by a GIN index.
- `searchPublished` now matches with `websearch_to_tsquery` + `ts_rank` relevance
  ranking (rank-aware keyset cursor) instead of a sequential ILIKE scan.
- Related listings: repository `findRelated` (same category, same brand first,
  excluding self), service `related()`, `GET /api/v1/passport/:pcxId/related`,
  and a "You may also like" grid on the storefront passport page.

## Slice 2 — BI reporting, exports, and scheduled exports (E14/E16)

- Migration `0045_scheduled_exports.sql`: `scheduled_exports` registry.
- BI dashboard `GET /api/v1/admin/reports/bi` (revenue by status, inventory value
  by grade, all server-derived).
- CSV export `GET /api/v1/admin/reports/operations/export?format=csv` and
  external-SIEM NDJSON export `GET /api/v1/admin/audit-logs/export?format=ndjson`.
- Scheduled exports: `GET`/`POST /api/v1/admin/scheduled-exports` + a worker
  `runDue` job (counts rows via injected `countRows`).
- Admin Reports workspace (`/reports`) + nav item.

## Slice 3 — Upload malware scanning (E17)

- `apps/api/src/modules/media/malware-scanner.mjs`: pluggable scanner interface +
  fail-closed signature scanner (EICAR test signature, executable magic bytes,
  embedded PHP/script/shell payloads).
- `createMediaService` scans every upload before storage and rejects hostile
  payloads with `MALWARE_DETECTED` (422). Default-on; wired in `auth-runtime`.

## Verification

- `npm run lint` and `npm run typecheck` pass.
- `npm test` with `TEST_DATABASE_URL`: 639/641 pass; the 2 failures are the
  pre-existing shared-DB integration pollution (sell-request + sell-taxonomy),
  unrelated to these changes.
- Headed-browser evidence (Playwright MCP) for the two UI-browsable slices:
  storefront passport related-items and admin Reports workspace; `npm run ui-guard`
  passes.
- `node scripts/merge-gate.mjs` → `OK: main is merged into origin/main`.

## Remaining (not in this run)

- E17 MFA gates (real MFA provider = hard stop).
- E19 S3/MinIO storage adapter swap + real malware gate (ClamAV).
- Bulk CSV import; container scanner; production deployment + real credentials
  (all hard stops).
