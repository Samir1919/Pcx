# Agent Handoff: Catalog Spam Dummy Model Cleanup

- Status: Complete
- Branch: agent/admin-web-crud-list-improvements
- Latest commit: 15e6018 (no new commit; database-only change on top of working tree)
- Date: 2026-08-18

## Outcome

The local development database (`postgresql://pcx:pcx_local_only@localhost:5432/pcx`) repeatedly accumulated spam/dummy catalog rows that were not part of the approved launch catalog seeds. The cleanup script now removes **every** non-seed row transactionally and keeps only the approved seed prefixes.

Final catalog counts:

| Table | Count | Seed prefix |
|---|---|---|
| `categories` | 10 | `80000000-` |
| `brands` | 14 | `81000000-` |
| `product_models` | 20 | `82000000-` |
| `spec_definitions` | 23 | `83000000-` |
| `model_spec_values` | 33 | `84000000-` |

Note: `spec_definitions` and `model_spec_values` counts increased from the earlier cleanup because migration `0022_catalog_desktop_pc_specs.sql` added 15 approved spec defs and 24 approved spec values, all with `83000000-`/`84000000-` prefixes.

## Changed areas

- `work/cleanup-junk-models.mjs` — one-off cleanup script (git-ignored under `work/`). Loads `.env`, opens a transaction, deletes any row whose id does not match the approved seed prefix, commits, and reports row counts. Re-runnable and idempotent.

No committed application source, migration, or test code changed. This is a development-database data cleanup only.

## Spam data identified and removed

- `product_models` not prefixed `82000000-` — 507 rows, including:
  - `72000000-` Alpha/Beta/Hidden test rows — 3
  - `76000000-` Spec Model test row — 1
  - `85000000-` Volume Model 0001..0500 test rows — 500
  - random UUIDs `31a11bbb-…` (PCX Tower 4), `9aed6a5c-…` (PCX Tower 3), `9ffd6f6c-…` (PCX Tower3, admin-created spam) — 3
- `spec_definitions` not prefixed `83000000-` (test defs) — 3
- `categories` not prefixed `80000000-` (GPU test, CPU test, Updated GPU, Spec Test, Volume Test) — 5
- `brands` not prefixed `81000000-` (test brands) — 3
- `model_spec_values` referencing non-seed models — 2

(An earlier run also removed a stray random-UUID `07783cf6-…` MacBook Air `screen_size_in` test value.)

## Acceptance criteria

- [x] Spam/dummy `product_models` removed; only the 20 quality seed models remain (`82000000-` = 20).
- [x] No quality seed rows were deleted (verified by prefix count: 10/14/20/23/33).
- [x] Follow-up checks left a clean database state.

## Verification

| Command/test | Result |
|---|---|
| `node work/cleanup-junk-models.mjs` | Success (transactional deletes: 2 spec values, 507 models, 3 spec defs, 5 categories, 3 brands) |
| Terminal SQL verification of final counts | 10/14/20/23/33, all seed prefixes only |

Older gate results from the first cleanup run (still valid since no app code changed): `npm run verify:e0` Pass (36 artifacts); `npm test` Pass (395 pass, 22 skip, 0 fail); catalog integration tests Pass (3/3).

Note: `catalog-seed-volume.test.mjs` re-inserts 500 `85000000-` volume models and does not clean them up. The cleanup script must be re-run after that integration test. This is pre-existing test behavior, not a regression.

## Architecture/security review

- Data-only operation; no invariants affected. `ProductModel` and `InventoryItem` remain separate concepts, and no inventory/sell-request/order rows referenced the removed junk models (verified count = 0 before deletion).
- Scope limited to non-production test/mock dummy rows; no production data or secrets touched.
- No ADR change required.

## Schema/configuration/deployment

None. No migrations, environment changes, or deployment.

## Remaining work and next safe action

1. (Optional) Add cleanup of `85000000-` volume rows to the `finally` block of `catalog-seed-volume.test.mjs` so it self-cleans.
2. Continue with the broader admin web CRUD/list improvements work on the current branch.

## Blockers requiring human decision

None.
