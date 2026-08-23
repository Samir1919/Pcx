# Handoff: Sell-to-PCX seller/admin UX completion (A→D)

- Branch: `agent/selltopcx-seller-admin-ux`
- Commits: `2b78c4a` (A), `3d64689` (B+C), `2567cca` (D), `e3c3232` (tests), docs/task
- Owner/agent: Cline
- Related task: `docs/tasks/SELLTOPCX_SELLER_ADMIN_UX.md`

## Completed scope

- **A — real submit + admin queue correctness**
  - `listAll()` filters out DRAFT so admin queue shows only SUBMITTED+.
  - admin UI no longer offers DRAFT→SUBMITTED (seller submits, not admin).
  - web sell "Submit" now creates then auto-submits DRAFT→SUBMITTED; message fixed.
- **B — seller offer/list/status view**
  - `GET /api/v1/sell-requests/:id/offers` (owner-scoped via acquisition service).
  - web `apps/web/app/sell-requests` page: status timeline + active offer amount + Accept/Decline.
- **C — admin sell-request detail**
  - `GET /api/v1/admin/sell-requests/:id` (admin-gated, non-owner).
  - admin acquisition page "View" → detail panel (declaration/contact/build/status).
- **D — profile + password + sell autosave**
  - `PATCH /api/v1/me` (fullName/phone only; email immutable), `POST /api/v1/me/password`.
  - web `apps/web/app/account` page: profile edit + change password.
  - sell form persists typed fallback name/phone back to profile.

## Acceptance criteria

- [x] seller submit → SUBMITTED; admin queue shows it, no DRAFT
- [x] admin cannot submit someone's draft
- [x] admin views sell-request detail
- [x] seller sees own requests + offer + accept/reject
- [x] seller name/phone saved; profile page CRUD + password change

## Verification

- `npm test`: 534 total, 508 pass, 0 fail, 26 skipped (DB integration).
- `npm run verify`: E0, lint, typecheck, tests, build, security all pass.
- Headed playright checks: `account.hasHeading=true`, `sellrequests.hasHeading=true`; `business-e2e` 11/11 (sell submit→admin queue + buy + shipment create→ship→deliver).

## Security notes

- Offer amount/status remain server-owned; accept/reject stay ownership-enforced.
- Profile email immutable; password change requires current password and revokes prior sessions; `password_change` is rate-limited.
- All writes preserve origin + double-submit CSRF.

## Unresolved / next safe task

- Slice B of prior double-sell follow-up (RESERVED→SOLD on payment confirm + inventory enum) remains deferred; tracked in `PROJECT_STATUS.md` Next work.
