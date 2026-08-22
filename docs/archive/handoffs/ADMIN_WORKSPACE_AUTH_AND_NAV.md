# Agent Handoff: Admin workspace auth, navigation, and seed-data views

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: `51e7a26`
- Date: 2026-08-17

## Outcome

The admin app is now a real multi-tab, login-aware workspace instead of a single hardcoded catalog page with dead sidebar links. It has a shared sidebar/topbar shell, working sign-in/register/sign-out backed by the server-authoritative auth API, a privileged-admin MFA sign-in path (dev adapter), and read-only pages that display the seeded demo data across operations, inventory, verification, and audit.

## Changed areas

- API
  - `apps/api/src/index.mjs` — decoupled browser origins via `API_ALLOWED_ORIGINS`; wired the development-only MFA adapter for non-production.
  - `apps/api/src/modules/identity/dev-mfa.mjs` (new) — deterministic dev MFA (code `123456`) behind the existing provider-neutral contract; never wired in production.
  - `apps/api/src/modules/identity/auth-http.mjs` — `Secure` cookies now default-on and are omitted only under `NODE_ENV=development` (required for `http://localhost`); `mfa_required` login now emits a short-lived CSRF-only cookie so `verify-mfa` can complete.
  - `apps/api/src/modules/identity/auth-abuse-control.mjs` — added the missing `mfa_verify` limiter key (previously made privileged MFA always rate-limit).
- Admin UI
  - Added `lib/api-client.js`, `lib/auth-api.js`, `lib/ops-api.js`.
  - `app/layout.js` + `app/auth-provider.js` + `app/user-shell.js` provide a shared shell and sign-in/sign-out state.
  - New route group `app/(workspace)/` with `layout.js` and pages: overview, catalog (moved), inventory, verification, audit, payments (moved), plus `/login` and `/register`.
  - Moved catalog/payments under `(workspace)` and stripped their duplicated `<aside>` shells; returning page fragments now wrap correctly in the shared shell.
- Seed
  - `scripts/seed-demo.mjs` — demo users now get documented dev passwords (argon2-hashed) so login works; added `PCX_DEV_MFA_CODE`/`API_ALLOWED_ORIGINS` env.
- `README.md` — demo accounts table, dev MFA note, and admin workflows.
- `apps/api/test/auth-http.test.mjs` — updated the privileged-MFA test to assert a CSRF-only cookie (not "no cookie").

## Acceptance criteria

- [x] Sidebar has real links that all navigate (no dead `<span>` placeholders).
- [x] Sign-in, register, and sign-out work end-to-end against the server (with privileged MFA in dev).
- [x] Overview/inventory/verification/audit pages render seeded data.
- [x] Catalog and payments still build and render inside the shared shell.
- [x] Auth hardening kept: Secure cookies default-on, CSRF enforced on writes, MFA gated by role.
- [x] No production deployment or real credential added.
- [x] `verify:e0`, `npm test`, admin build all pass.

## Verification

| Command/test | Result |
|---|---|
| `npm run build -w @pcx/admin` | Pass — all routes compile |
| Live login (`POST /api/v1/auth/login`) with demo admin | 202 `mfa_required` + CSRF cookie |
| `POST /api/v1/auth/verify-mfa` + `GET /api/v1/me` | 200, identity `ADMIN` |
| `GET /api/v1/admin/reports/operations` | 200, seed counts/orders |
| `GET /api/v1/admin/inventory` | 200, seeded items |
| `GET /api/v1/admin/audit-logs` | 200, seeded audit rows |
| `node --test apps/api/test/auth-http.test.mjs` | 9/9 pass |
| `npm run verify:e0` | 36 required artifacts pass |
| `npm run lint` | pass |
| `npm test` | 343 total; 321 passed; 22 PostgreSQL integration skips by design; 0 failed |

## Architecture/security review

No PCX commerce invariant or source-of-truth rule changed. The MFA boundary remains server-authoritative: the dev MFA adapter is injected only when `NODE_ENV !== "production"`, so production privileged login continues to fail closed (`mfa_unavailable`) until a real provider is approved. Cookies remain `HttpOnly`/`SameSite=Strict`; `Secure` is omitted only under explicit `NODE_ENV=development`, preserving the auth boundary for any non-dev environment. Browser origins are now an explicit allow-list (`API_ALLOWED_ORIGINS`) rather than reused from the API URL.

## Schema/configuration/deployment

No migration. New env: `API_ALLOWED_ORIGINS`, `PCX_DEV_MFA_CODE`. Production deployment and real credentials remain hard stops.

## Remaining work and next safe action

1. Install/authenticate a real container scanner to produce an actual image vulnerability report.
2. Implement a real bKash HTTP adapter behind the injected gateway contract (sandbox-only until real credentials are approved).
3. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None for this slice. Production deployment, real MFA provider, and real credentials remain hard stops requiring explicit human approval.
