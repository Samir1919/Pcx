# Agent Handoff: Sell Flow Config DB-Driven (Slice A)

- Status: Complete
- Branch: `agent/sell-taxonomy-config`
- Date: 2026-08-20

## Outcome

The Sell-to-PCX web page no longer hardcodes the four entry points and their build-component role mappings. The sell-flow config now lives in PostgreSQL next to the catalog (single catalog source of truth) and is editable from the Admin Catalog workspace.

## Changed areas

- `apps/api/migrations/0030_sell_taxonomy.sql` — thin `sell_entry_config` + `sell_build_components` tables (FK to `categories.id`), seeded with the four canonical entries. Additive/non-destructive.
- `packages/domain/src/acquisition/sell-taxonomy.mjs` — validation factories for entry config and build-component role mapping; keys/icons/roles enforced from canonical enums. Exported via `packages/domain/src/index.mjs`.
- `apps/api/src/modules/catalog/postgres-sell-taxonomy-repository.mjs` — public/admin read (joins categories; resolves build components and PARTS children).
- `apps/api/src/modules/catalog/postgres-sell-taxonomy-command-repository.mjs` — admin writes with atomic audit.
- `apps/api/src/modules/catalog/sell-taxonomy-service.mjs` — public read + admin `CATALOG_MANAGE`-gated updates.
- `apps/api/src/modules/catalog/sell-taxonomy-http.mjs` — `GET /api/v1/sell-taxonomy` (public) + `GET/PATCH /api/v1/admin/sell-entry-config*` (CSRF/Origin/admin).
- `apps/api/src/modules/identity/auth-runtime.mjs`, `apps/api/src/server.mjs` — wiring.
- `apps/web/lib/storefront-api.js` — `sellTaxonomy()` client method.
- `apps/web/app/sell/page.js` — removed `ENTRIES`/`BUILDS`/`PART_ENTRIES`; derives everything from the taxonomy API.
- `apps/admin/lib/sell-taxonomy-api.js` — admin client.
- `apps/admin/app/(workspace)/catalog/sell-flow-panel.js` + `workspace.js` — new "Sell flow" tab inside Catalog workspace.

## Acceptance criteria

- [x] Public categories remain the single taxonomy source of truth; no duplicate category table.
- [x] Four sell entries and their build role→category mapping serve from DB.
- [x] Admin edits icon/hint/sort/active and BUILD role→category/required/sort in Catalog workspace.
- [x] Web sell page renders entries fully from the public taxonomy API.
- [x] Domain guards reject unknown entry keys, roles, icons, and malformed UUIDs.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/sell-taxonomy-service.test.mjs apps/api/test/sell-taxonomy-http.test.mjs` | 10 pass |
| `TEST_DATABASE_URL=... node --test .../sell-taxonomy-repository.test.mjs .../migrations.test.mjs` | 3 pass (against local Postgres) |
| `npm test` | 447 pass, 0 fail, 26 skipped |
| `npm run verify:e0` | Pass (36 artifacts) |
| `node scripts/lint-check.mjs` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |

## Architecture/security review

- `categories` stays the single catalog truth; config is a thin FK overlay, not a duplicate taxonomy.
- Icon is stored as a curated `icon_key`, mapped to emoji on the web. Admin cannot inject raw markup.
- Admin writes require `CATALOG_MANAGE` + CSRF double-submit + allowed origin; audit events appended.
- Public endpoint exposes only category id/slug/name, role, required, sort, icon_key, hint — no cost/serial/private evidence.
- No core invariant or pricing rule changed.

## Schema/deployment

Additive migration `0030_sell_taxonomy.sql`. No production deploy, no destructive migration.

## Remaining work (dependency order)

1. Slice B — remove `PLACEHOLDER_RANGES` in `sell-request-service.mjs`, unify quote service; move Quotes UI from Acquisition to Catalog.
2. Slice C — implement canonical merged sell-request state machine (§12/ADR reconciliation; `PRELIMINARY_REVIEW` → `REVIEWING`).
3. Slice D — state-driven acquisition admin UI; fix `expiresAt`/`publicRequestNo`/`sellerUserId`.

## Blockers requiring human decision

None.
