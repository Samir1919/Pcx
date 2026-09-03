# Agent Handoff: Sell Flow Runtime Configuration

- Status: Complete
- Branch: main
- Latest commit: `67ab48d`
- Date: 2026-09-03

## Outcome

The admin Catalog → Sell flow configuration now genuinely controls the public
customer sell flow, and new catalog categories can be promoted to sell entries
at runtime.

1. **Customer `/sell` is API-driven** (commit `9e4bc76`). It no longer renders
   hardcoded `ENTRIES`/`BUILDS`/`PART_ENTRIES`; instead it derives the entry
   chooser, build component roles, and PARTS children from the public
   `GET /api/v1/sell-taxonomy` payload. The admin "Active" toggle (and
   icon/hint/sort/component config) therefore takes effect on the storefront,
   and inactive entries are hidden.

2. **Runtime sell-entry creation** (commit `67ab48d`). `POST
   /api/v1/admin/sell-entry-config` promotes any catalog category to a sell
   entry. `entry_key`/`sell_entry`/`icon_key` are generalized from a fixed
   four-value enum to canonical forms, and the server derives the entry key from
   the category slug via `sellEntryKeyFromSlug`.

## Changed areas

- `apps/web/app/sell/page.js` — replace hardcoded constants with taxonomy fetch;
  memoize derived `build`/`partEntry` so model-loading effects do not loop.
- `packages/domain/src/acquisition/sell-entry.mjs` — `parseSellEntry` accepts
  canonical `^[A-Z][A-Z0-9_]*$` (was the four-value enum).
- `packages/domain/src/acquisition/sell-taxonomy.mjs` — generalize
  `parseSellEntryKey`/`parseSellEntryIcon`; add `sellEntryKeyFromSlug`.
- `packages/domain/src/index.mjs` — export `sellEntryKeyFromSlug`.
- `apps/api/migrations/0047_sell_taxonomy_generalize.sql` — relax the three
  CHECK constraints (non-destructive; seeds still satisfy them).
- `apps/api/src/modules/catalog/postgres-sell-taxonomy-command-repository.mjs`
  — `createEntry` INSERT with audit.
- `apps/api/src/modules/catalog/sell-taxonomy-service.mjs` — `createEntry` +
  `normalizeCreate` + `resolveCategorySlug`; inject `catalogService`.
- `apps/api/src/modules/catalog/sell-taxonomy-http.mjs` — `POST` collection
  route; map `already_exists` (409) and `unavailable` (503).
- `apps/api/src/modules/identity/auth-runtime.mjs` — inject `catalogService`.
- `apps/admin/lib/sell-taxonomy-api.js` — `createEntry` client method.
- `apps/admin/app/(workspace)/catalog/sell-flow-panel.js` — "Add sell entry"
  multi-field `<form>`; expanded icon presets.
- Tests: domain (`sell-entry`, new `sell-taxonomy`), service, HTTP, integration
  (`createEntry` + duplicate), `sell-request-service` updated for the relaxed
  key shape.

## Acceptance criteria

- [x] Customer `/sell` renders only active entries from the taxonomy API.
- [x] Build roles and PARTS children render from API `components`/`children`.
- [x] Inactive entries are hidden (is_active=false hid Laptop/Laptop Parts).
- [x] Admin can create a sell entry from any category (POST 201; `Monitor` →
      `MONITOR` appeared on `/sell`).
- [x] Duplicate category promotion returns 409.
- [x] Migration 0047 applied; constraints verified via psql.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (694 tests / 662 pass / 0 fail / 32 skipped; security + ui-guard accepted) |
| `npm test` | 694 tests, 0 fail |
| `node --test .../sell-taxonomy*.test.mjs` + domain | 22 pass |
| Integration `sell-taxonomy-repository.test.mjs` (fresh createEntry test) | Pass (seeded-list test fails only on shared-DB is_active pollution, pre-existing) |
| `node scripts/merge-gate.mjs` | OK: main merged into origin/main |

## Architecture/security review

- Server owns the canonical `entry_key` derivation from the category slug; the
  client never authors it. `createEntry` is `CATALOG_MANAGE`-gated and
  CSRF/origin-protected; writes are audited (`SELL_ENTRY_CREATED`).
- Duplicate promotion is prevented by the unique `category_id` mapping and
  mapped to 409 `SELL_TAXONOMY_CONFLICT`.
- Relaxing the `sell_requests.sell_entry` CHECK preserves the invariant that a
  submitted request references a canonical entry key (format-validated), but now
  allows runtime-created entries. No ADR required (additive relaxation, seeds
  unchanged); recorded here for continuity.

## Schema/configuration/deployment

- Migration `0047_sell_taxonomy_generalize.sql` (additive, non-destructive),
  applied to the local dev DB. No env/config change. No production deployment.

## Remaining work and next safe action

1. Sell-entry hard delete/archive UI (soft `isActive` already covers hiding).
2. Drag-to-reorder instead of numeric sort.
3. Generalize BUILD component roles beyond the seed `BuildComponentRole` enum
   for arbitrary new build categories (larger change; touches
   `sell_build_components.role` CHECK + `createBuildComponent`/`validateBuildComponents`).

## Blockers requiring human decision

None. (Production deployment and real payment/provider credentials remain the
standing human-approval hard stops.)
