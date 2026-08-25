# Agent Handoff: Remove internal valuation concept

- Status: Complete
- Branch: `agent/remove-valuation` (merged into `main`)
- Latest commit: `b160fe5` (feature) / `25b57ad` (merge into main)
- Date: 2026-08-25

## Outcome

The internal `valuation` entity is removed. Offers are now created directly
from a sell request (`sellRequestId` + `amount` + `expiresAt`), shortening the
admin acquisition flow from valuation → offer → acquisition to offer →
acquisition. The `valuations` table and `offers.valuation_id` are dropped via
idempotent destructive migration `0035_remove_valuation.sql`.

## Changed areas

- `packages/domain/src/acquisition/valuation-offer.mjs`: `createValuation`/
  `ValuationType` removed; `createOffer` no longer accepts `valuationId`.
- `packages/domain/src/index.mjs`: exports updated.
- `apps/api/src/modules/acquisition/acquisition-service.mjs`, `acquisition-http.mjs`,
  `postgres-acquisition-repository.mjs`: valuation method/route/query removed;
  offer queries use a shared `offerColumns`.
- `apps/admin/app/(workspace)/acquisition/page.js`, `sell-request-modal.js`,
  `apps/admin/lib/acquisition-api.js`: "Create valuation" form removed; offer
  form drops the `valuationId` field.
- `apps/api/migrations/0035_remove_valuation.sql`: idempotent DROP of
  `valuations` and `offers.valuation_id`.
- `scripts/seed-demo.mjs`: seeds offers directly (no valuation row).
- `scripts/admin-e2e-check.mjs`: asserts detail modal renders without a
  valuation form.
- `scripts/browser-verify-guard.mjs`: `runGuard` made async (awaits evidence read).
- Specs: DATABASE_ERD, API spec, BPR, User Flow Screen Map updated.
- `docs/adr/0012-remove-valuation-concept.md` + task file added.

## Acceptance criteria

- [x] `createValuation`/`ValuationType`/`valuation_id` absent from domain, API, admin UI, seed.
- [x] Migration 0035 drops `valuations` + `offers.valuation_id` idempotently; integration test asserts both gone.
- [x] Specs no longer reference the valuation entity/endpoint/flow step.
- [x] `npm run verify` gates pass; headed browser evidence accepted.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass (569 tests / 542 pass / 0 fail / 27 skip) |
| `npm run build` | Pass |
| `npm run security` | Pass |
| `npm run ui-guard` | Pass (headed evidence accepted) |
| `TEST_DATABASE_URL=... npm run test:integration` | Pass (27/27) |
| `node scripts/merge-gate.mjs` | OK: main merged into origin/main |

## Architecture/security review

- ADR 0012 records the domain/source-of-truth change and destructive migration
  (user-approved hard stop).
- "Estimated seller ranges are not final offers" invariant preserved via the
  indicative quote range (`indicative_prices`), a distinct server-owned object.
- Offer `amount`/`status` remain server-owned; no new endpoints/data exposure;
  write endpoints remain CSRF + RBAC gated.

## Schema/configuration/deployment

- Migration `0035_remove_valuation.sql` (destructive, idempotent). Rollback is
  restore-from-backup before this migration. No production deployment.

## Remaining work and next safe action

- Rebuild/restart dev containers so the running API picks up the new code (the
  old running container no longer matches the migrated schema).
- Continue with the next dependency-ready work in PROJECT_STATUS.md.

## Blockers requiring human decision

None.
