# Agent Handoff: E1 Authentication HTTP Boundary

- Status: Complete
- Branch: `agent/e1-auth-http-boundary`
- Latest commit: recorded by Git after verification
- Date: 2026-08-16

## Outcome

Added versioned register/login/refresh/logout HTTP routes with bounded JSON parsing, field allow-lists, exact trusted-origin enforcement, Secure/HttpOnly/SameSite credential cookies, timing-safe double-submit CSRF checks, cookie rotation/clearing, hashed network context, and stable non-leaking errors.

## Changed areas

- `apps/api/src/modules/identity/auth-http.mjs`: browser authentication transport boundary.
- `apps/api/src/server.mjs`: routes auth requests before public catalog routing and bounds request IDs.
- `apps/api/test/auth-http.test.mjs`: HTTP security and error-contract coverage.
- `docs/tasks/E1_AUTH_HTTP_BOUNDARY.md`: bounded task record.

## Acceptance criteria

- [x] Only the four specified POST routes are exposed.
- [x] Bodies and fields are bounded/allow-listed.
- [x] Credentials appear only in secure cookies, never JSON.
- [x] Origin and refresh/logout CSRF checks fail closed.
- [x] Login/refresh rotate cookies and logout/invalid refresh clear stale cookies.
- [x] Errors preserve request IDs without leaking internal messages.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/auth-http.test.mjs apps/api/test/auth-service.test.mjs` | Pass — 13/13 |
| `npm run verify:e0` | Pass — 36 required artifacts |
| `npm test` | Pass — 38 passed, 2 PostgreSQL-dependent tests skipped |
| `npm run verify` | Pass — E0, lint, typecheck, unit tests, build |
| `git diff --check` | Pass |

## Architecture/security review

The API modular monolith remains the browser auth boundary under ADR 0003. Exact origin allow-listing prevents suffix/prefix matches. Access and refresh cookies are Secure, HttpOnly, and SameSite=Strict; refresh is limited to `/api/v1/auth`. CSRF uses a separately scoped non-HttpOnly cookie and timing-safe header comparison. Password/credentials never enter JSON responses, request IDs/user agents are bounded, and IP addresses are hashed before application-service use.

This slice requires an injected auth service and configured origin set; absent dependencies return 503. Production database/audit/limiter composition remains intentionally unwired and is not represented as launch-ready.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Implement durable auth audit persistence plus the concrete API composition root for PostgreSQL identity/auth dependencies and a bounded local/test abuse limiter. Keep production configuration/deployment as a hard stop.

## Blockers requiring human decision

None.
