# Handoff: Full-Stack A→Z Verification Harness

- Branch: `agent/fullstack-a-to-z-verify`
- Commit: `6a5d7e5` (feat(verify): full-stack A→Z verification harness + seed idempotency fix)
- Owner/agent: Cline
- Related task: `docs/tasks/FULLSTACK_A_TO_Z_VERIFY.md`
- Risk: Medium

## Objective and completed scope

Unify API/admin/web logic and verify every admin and web function in a real
browser in a human-like way, fixing any error found.

Completed:

1. Mapped every customer-web page and admin workspace to its API client and
   backend HTTP handler (`apps/api/src/server.mjs` + `*-http.mjs` handlers).
2. Built `scripts/storefront-e2e-check.mjs` — a human-like click-through check
   for the customer storefront: home, storefront search/filter, sell landing +
   3-step sell flow (part category/model selection + quote + contact step),
   login/register/verify, passport open, guest buy flow, and customer sign-in.
3. Built `scripts/admin-e2e-check.mjs` — signs in as demo admin (email +
   password + dev MFA 123456), visits all 14 operational workspaces, and opens
   the catalog edit modal, inventory inspect modal, and listings photos modal.
4. Fixed a `scripts/seed-demo.mjs` idempotency bug: the reservation insert used
   an "item has no ACTIVE row" guard plus a fixed id, so a re-run after the
   prior reservation had expired hit `reservations_pkey`. Now idempotent by
   fixed id while still preserving the one-active-per-item invariant.
5. Wired `npm run web:e2e` and `npm run admin:e2e` into `package.json`.

No business logic, invariant, or schema change was required; all found issues
were produced by the seed data path only. All server-authoritative behavior
verified unchanged.

## Acceptance criteria status

- [x] Phase A: stack + seed + baseline; page→API→module map confirmed.
- [x] Phase B: every customer-web page verified (storefront-e2e 12/12).
- [x] Phase C: every admin page verified authenticated (admin-e2e 18/18).
- [x] Phase D: discovered mismatch fixed server-authoritatively (seed idempotency).
- [x] Phase E: `web:check`, `web:e2e`, `admin:e2e`, lint, typecheck, build,
      security, and `npm test` pass.

## Commands run and results

- `npm run verify:e0` — pass (33 required artifacts).
- `npm run seed:demo` — pass after fix (idempotent).
- `npm run web:check` — pass (4 pages).
- `node scripts/storefront-e2e-check.mjs` — 12/12 pass.
- `node scripts/admin-e2e-check.mjs` — 18/18 pass.
- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `npm run security` — pass.
- `npm test` — 526 total, 500 pass, 0 fail, 26 skipped (DB integration).

## Files changed

- `package.json` — add `web:e2e` and `admin:e2e` scripts.
- `scripts/seed-demo.mjs` — reservation idempotency fix.
- `scripts/storefront-e2e-check.mjs` — new.
- `scripts/admin-e2e-check.mjs` — new.
- `docs/tasks/FULLSTACK_A_TO_Z_VERIFY.md` — new task file.

## Security and architecture notes

- Browser checks are headless (CI-style gate). Interactive headed MCP was not
  used because the Playwright MCP server was not connected in this session;
  `npm run web:check`-style headless checks were expanded instead. No
  browser-facing code was changed, so the headless gate is the appropriate
  evidence level here.
- No production policy, credentials, destructive migration, or invariant change.

## Unresolved findings / blockers

None. All checks green.

## Next safe task

- Promote `web:e2e` + `admin:e2e` into `npm run verify:ci` if desired (needs a
  running stack in CI), or proceed to the next dependency-ready epic.
