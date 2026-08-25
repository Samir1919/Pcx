# Agent Handoff: Fix sell media upload + admin acquisition detail

- Status: Complete
- Branch: `agent/fix-sell-media-admin-detail` (merged into `main`)
- Latest commit: `783aa94` (feature) / `9cfd732` (merge into main)
- Date: 2026-08-25

## Outcome

Sell-flow photo upload now works end-to-end (it was silently 404'ing), and the
admin acquisition detail/queue now show human-readable model names, split
contact fields, and no longer throw a client TypeError when creating an offer.

## Changed areas

- `apps/api/src/server.mjs`: media handler runs before the sell-request and
  listing handlers so `/:id/media` is no longer shadowed (was 404).
- `apps/api/src/modules/media/media-http.mjs`: `send()` JSON-stringifies
  non-buffer bodies (error/JSON responses no longer crash `response.end`).
- `apps/api/src/modules/acquisition/sell-request-service.mjs`: `withModelNames`
  resolves catalog names via the injected `catalogService` read for
  `listAdmin`/`getAdmin`; degrades to the id when a model is missing/inactive.
- `apps/api/src/modules/identity/auth-runtime.mjs`: injects `catalogService`.
- `apps/admin/.../acquisition/page.js` + `sell-request-modal.js`: queue Model
  column and build-component table show names; contact split into
  Name/Phone/Email; `event.currentTarget.reset()` captured before `await`.
- `apps/api/test/sell-request-service.test.mjs`: covers name resolution.
- `.gitignore`: ignores `apps/api/uploads/`.

## Acceptance criteria

- [x] Storefront sell-flow photo upload persists media (was 404, now works).
- [x] Admin offer creation returns 201 with no client TypeError.
- [x] Admin queue/detail show model names instead of raw UUIDs.
- [x] Contact shown as separate Name/Phone/Email fields.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (570 tests / 543 pass / 0 fail / 27 skip; ui-guard accepted) |
| `node scripts/merge-gate.mjs` | OK: main merged into origin/main |
| Playwright MCP (headed) | sell photo upload + admin detail/offer verified |

## Architecture/security review

- Modular-monolith boundary preserved: model names resolved through the catalog
  module's public read, never a raw cross-module query.
- Media route shadowing fixed without weakening ownership/CSRF/origin checks.
- Offer/acquisition price/status remain server-owned.

## Schema/configuration/deployment

None. No migrations.

## Remaining work and next safe action

- Optional admin acquisition simplification (auto-fill offer/acquisition IDs
  from state) remains deferred, tracked in PROJECT_STATUS.md next work.
- Bulk CSV import, real container scanner, and real bKash adapter remain the
  next dependency-ready work.

## Blockers requiring human decision

None.
