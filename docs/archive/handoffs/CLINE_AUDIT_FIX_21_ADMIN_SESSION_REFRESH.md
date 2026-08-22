# Agent Handoff: Admin Session Stops Silently Refreshing (Frequent Logout)

- Status: Complete
- Branch: `agent/fix-admin-session-refresh`
- Latest commit: `fe81c6e`
- Date: 2026-08-18

## Outcome

The admin control room was logging the user out repeatedly. Root cause: server access tokens
expire after 15 minutes (`sessionPolicy.accessLifetimeMs`), but the admin client never called
the existing `POST /api/v1/auth/refresh` endpoint. Once the access token expired, `/api/v1/me`
returned 401, `currentIdentity()` resolved to `null`, and `user-shell.js` redirected to
`/login`.

The admin API client now performs a **single-flight, silent session refresh** when a privileged
request returns 401, then retries the original request once. The refresh token is HttpOnly and
sent automatically via `credentials: "include"`; the refresh call carries the double-submit CSRF
token, exactly as the auth boundary requires. If the refresh itself fails (e.g. the 30-day
refresh token is gone), the original 401 is preserved so the shell still routes to `/login` —
the correct final behavior.

No server contract, invariant, or schema changed.

## Changed areas

- `apps/admin/lib/api-client.js`
  - Added `authPaths` allow-list so `login`/`register`/`refresh`/`logout`/`verify-mfa` never
    self-refresh.
  - Added `refreshSession()` with single-flight `refreshInFlight` de-duplication and fail-closed
    CSRF handling.
  - Split the core fetch into `requestOnce()` and wrapped it in `apiRequest()`: privileged 401 →
    one refresh → one retry; on refresh failure the original 401 is re-thrown.
- `apps/admin/test/api-client.test.mjs`
  - New regression tests covering: privileged 401 refresh+retry, auth endpoints never
    self-refresh, failed refresh preserves original 401, missing CSRF falls back to 401 without
    looping, and concurrent 401s share one refresh.

## Acceptance criteria

- [x] A privileged request returning 401 triggers exactly one `/api/v1/auth/refresh` call and retries.
- [x] Auth lifecycle endpoints never trigger a self-refresh loop.
- [x] A failed refresh preserves the original 401 (so `/login` redirect still works).
- [x] Concurrent 401s share a single refresh.
- [x] No server/domain/schema change; no invariant weakened.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/admin/test/api-client.test.mjs apps/admin/test/auth-api.test.mjs` | Pass — 7/7 |
| `npm run verify` (full) | Pass — E0, lint, typecheck, tests (409 total, 387 pass, 0 fail, 22 skipped integration), build, security |

## Architecture/security review

- Security posture is unchanged and improved operationally: the session boundary remains
  server-owned; the client merely exercises the already-secured refresh endpoint.
- Refresh is fail-closed: a missing CSRF token short-circuits to the original 401, and the
  `authPaths` guard prevents infinite loops.
- No secrets, credentials, or production policy involved. No hard stop triggered.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

1. Merge `agent/fix-admin-session-refresh` back to `main` after review (normal repository merge
   gate).
2. Optional follow-up: move the shared 401-refresh logic into a small module if the customer web
   app ever needs authenticated sessions (currently it is public/anonymous).

## Blockers requiring human decision

None.
