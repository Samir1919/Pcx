# Agent Handoff: Trusted-Device "Remember Me" CSS + Migration Fix

- Status: Complete
- Branch: `agent/trusted-device-mfa`
- Related ADR: `docs/adr/0010-trusted-device-mfa.md`
- Related slice: `docs/handoffs/CLINE_TRUSTED_DEVICE_MFA.md`
- Date: 2026-08-20

## Objective

The admin verification step's "Remember this device for 30 days" feature did not
appear to work. Visible problems: the checkbox CSS was broken, and verifying
with the box checked returned a 500 so no device cookie was ever issued.

## Diagnosis (observed, not assumed)

- Browser (headless Chromium / Playwright) showed the checkbox computed width as
  `213px` instead of `17px`. Root cause: in `apps/admin/app/globals.css`,
  `.check input { width: 17px }` (line ~479) and `.authCard input { width: 100% }`
  (line ~844) have equal specificity (0,1,1), but `.authCard input` appears later
  in the file, so it wins and stretches the checkbox across the card.
- With the checkbox ticked, `POST /api/v1/auth/verify-mfa` returned
  `500 INTERNAL_ERROR`. Root cause: the `trusted_devices` table did not exist in
  the local dev database — `schema_migrations` stopped at `0028_user_full_name.sql`
  and `0029_trusted_devices.sql` had never been applied. `issueTrustedDevice`
  then failed, surfacing as an internal error. (Unticked, that code path is
  skipped, which masked the bug.)

## Changed areas

- `apps/admin/app/globals.css`
  - `.authCard label>span` → `.authCard label:not(.check)>span`
  - `.authCard input` → `.authCard label:not(.check) input`
  - `.authCard input:focus` → `.authCard label:not(.check) input:focus`
  - Added `.authCard .check { accent-color: var(--green); }`
  - Net effect: auth text inputs keep `width:100%`, but the `.check` checkbox
    retains its 17px intrinsic size and uses the brand green accent.
- DB: applied additive migration `0029_trusted_devices.sql` against local dev via
  `npm run db:migrate` (no schema change, no new migration file — the file already
  existed on this branch).

## Verification

| Check | Result |
|---|---|
| Headless browser: checkbox computed size | 17×17px, accent `rgb(23, 95, 76)` |
| `POST /verify-mfa` with `rememberDevice` | 200 (was 500) |
| `pcx_device` cookie | present, HttpOnly, SameSite=Strict, path `/api/v1/auth`, 30-day TTL |
| Second login from same device | MFA skipped, redirected to workspace |
| `npm run verify:e0` | Pass (36 artifacts) |
| `node --test apps/api/test/auth-service.test.mjs apps/api/test/auth-http.test.mjs` | Pass (24/24) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass (437 pass, 0 fail, 24 skipped integration) |

## Architecture/security review

- No privilege, role, or invariant change. Trust remains server-issued only after
  a verified MFA event, bounded to 30 days, revocable, and stored hash-only.
- The only committed change is CSS; the functional fix was a local dev migration,
  not a source change.

## Schema/configuration/deployment

- Additive `0029_trusted_devices.sql` must be applied to any environment where the
  trusted-device feature is exercised (`npm run db:migrate`).

## Unresolved findings / next safe actions

- Production MFA provider selection remains a hard stop (unchanged).
- Device revocation/management UI is still out of scope (ADR 0010).
- Consider merging `agent/trusted-device-mfa` to `main` after review.
