# Agent Handoff: Public Quote + Identity-Reused Contact Details

- Status: Complete
- Branch: `agent/public-quote-identity-reuse`
- Latest commit: `30302c2`
- Date: 2026-08-19

## Outcome

The Sell-to-PCX indicative quote is now viewable without signing in. Sign-in is scoped to submission/listing actions. Sell-request contact details (name, email, phone) are reused from the authenticated identity on the server instead of re-asked on the form. A nullable `users.full_name` column supports the reused display name.

## Changed areas

- `apps/api/migrations/0028_user_full_name.sql` — additive nullable `users.full_name`.
- `packages/domain/src/identity/identity-record.mjs` — registration candidate accepts/returns optional `fullName`.
- `apps/api/src/modules/identity/auth-service.mjs` — `authenticateAccess`/`login` return `email`, `phone`, `fullName`; `register` passes `fullName` through.
- `apps/api/src/modules/identity/auth-http.mjs` — allow `fullName` on the register body.
- `apps/api/src/modules/identity/postgres-identity-repository.mjs` — persist `full_name`; include `email`/`phone`/`full_name` in contact lookup and active-identity lookup.
- `apps/api/src/modules/acquisition/sell-request-service.mjs` — derive contact details from identity (server-authoritative), form values only fallback.
- `apps/web/app/sell/page.js` — public quote flow; sign-in only on submit; identity-reused contact display with fallback inputs.
- `apps/web/app/register/page.js`, `apps/web/lib/storefront-api.js` — optional full name.

## Acceptance criteria

- [x] `/sell` shows quote range without sign-in.
- [x] Submit gates on sign-in; anonymous user sees a sign-in CTA.
- [x] Sell request reuses identity name/email/phone on the server.
- [x] `users.full_name` persisted and returned via register/login/`/me`.
- [x] `verify:e0`, lint, typecheck, security, full unit `npm test`, `web:check` pass.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |
| `npm test` | 426 pass, 0 fail (23 skipped integration) |
| `npm run web:check` | Pass (4 pages, no client errors) |

## Architecture/security review

- "Estimated seller ranges are not final offers" preserved; every public quote keeps the disclaimer.
- "Client input never authoritatively sets price/role/status" preserved; contact identity is derived server-side from the authenticated session.
- No invariants weakened; additive migration only; no production deployment.

## Remaining work / next safe action

1. Final-offer / inspection / valuation state machine remains placeholder/partial.
2. Merchant marketplace listing UX still requires sign-in (unchanged); no new permission added.

## Blockers requiring human decision

None.
