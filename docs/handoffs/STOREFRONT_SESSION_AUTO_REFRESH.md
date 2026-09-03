# Agent Handoff: Storefront Session Auto-Refresh (fix for repeated logouts)

- Status: Complete
- Branch: main
- Date: 2026-09-03

## Outcome

Fixed the customer web storefront repeatedly logging users out. The access token
lifetime is 15 minutes (`credentials.mjs` `accessLifetimeMs`), and the admin
client auto-refreshed it on 401, but the storefront client did not — so every
~15 minutes a signed-in customer's `me()` returned 401 and the nav bounced to
"Sign in". The storefront client now mirrors the admin client: on a 401 from a
non-auth endpoint it performs a single-flight `POST /api/v1/auth/refresh`
(CSRF-gated, HttpOnly refresh cookie) and retries the original request once,
recomputing the double-submit CSRF token for write retries (refresh rotates it).

## Changed areas

- `apps/web/lib/storefront-api.js` — split `request` into `requestOnce` +
  `refreshSession` + a retry wrapper; added `authPaths` so auth endpoints never
  self-refresh.
- `apps/web/test/storefront-api.test.mjs` — 4 new tests: auto-refresh+retry,
  no self-refresh on auth paths, no refresh on non-401, CSRF token rotation on
  write retry.
- `scripts/storefront-session-refresh-check.mjs` — new headed evidence script
  (sign in → remove `pcx_access` → reload → still signed in + refresh observed).

## Acceptance criteria

- [x] A 401 on a protected storefront call triggers exactly one refresh + retry.
- [x] Auth lifecycle endpoints (login/register/refresh/logout/verify-mfa) never self-refresh.
- [x] Non-401 errors are not refreshed.
- [x] Write retries use the rotated CSRF token.
- [x] Headed browser evidence committed (3/3 steps).

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (verify:e0, lint, typecheck, 680 tests / 0 fail, build, security, ui-guard) |
| `node --test apps/web/test/storefront-api.test.mjs` | 9/9 pass |
| `PCX_HEADED=1 node scripts/storefront-session-refresh-check.mjs --evidence` | 3/3 pass |

## Architecture/security review

- No change to token lifetimes, cookie attributes, or the server auth boundary.
  The refresh token stays HttpOnly/`SameSite=Strict`, scoped to `/api/v1/auth`,
  and refresh remains CSRF-gated and single-flight. The server stays the authority
  for session validity/rotation.
- The admin client already had this behavior; this only closes the storefront gap.

## Schema/configuration/deployment

- None. No migration; no new environment variables.

## Remaining work and next safe action

- `uploadBinary` (sell-request media uploads) still has no auto-refresh wrapper;
  a long-idle upload would 401. Wrap it with the same refresh+retry if desired.
- (Existing, unrelated) seller-facing storefront surface for post-acceptance
  acquisition/payment status (S14/S15) remains the next storefront slice.

## Blockers requiring human decision

- None.
