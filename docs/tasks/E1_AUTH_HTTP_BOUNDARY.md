# Task: E1 Authentication HTTP Boundary

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-auth-http-boundary`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Expose the accepted authentication service through bounded versioned JSON endpoints with secure cookie transport, origin/CSRF enforcement, and stable error responses.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` sections 2, 3, 24, 25, and 27
- `docs/specifications/SECURITY_ARCHITECTURE.md` sections 4, 6, 8, 14–16
- `docs/adr/0003-authentication-boundary.md`
- `docs/handoffs/E1_AUTH_APPLICATION_SERVICE.md`

## Scope

- `POST /api/v1/auth/register|login|refresh|logout`.
- Bounded JSON body and allow-listed field validation.
- Exact trusted-origin checks on every browser auth action.
- Secure, HttpOnly, SameSite cookies for access/refresh credentials.
- Double-submit CSRF validation for refresh/logout and rotated CSRF token issuance.
- Stable validation/auth/rate-limit/dependency error mapping.

## Non-scope

- Contact verification/reset/MFA, production origin configuration, database wiring, distributed rate-limit storage, or deployment.

## Domain invariants affected

- Roles/status remain absent from accepted request fields and server-owned by the service.
- Raw credentials exist only at the HTTP transport boundary and secure cookies.
- Session refresh/logout state transitions remain server enforced.

## Acceptance criteria

- [x] Unknown auth paths/methods fail predictably and bodies are bounded JSON objects.
- [x] Register/login accept only documented fields and never return raw credentials in JSON.
- [x] Login/refresh issue correctly scoped Secure cookies.
- [x] Refresh/logout require exact trusted origin and matching CSRF cookie/header.
- [x] Refresh rotates all credential/CSRF cookies; logout expires them even for an unknown session.
- [x] Application errors map to stable non-leaking HTTP responses with request IDs.

## State/API/schema/UI impact

Adds four `/api/v1/auth/*` POST routes. No schema or UI change.

## Security and privacy review

Origin matching is exact and fail closed. Credential cookies are Secure, HttpOnly, and SameSite=Strict. Refresh is path-scoped; CSRF uses a separate non-HttpOnly double-submit cookie and timing-safe comparison. Request sizes, content type, fields, user agent, and request IDs are bounded. Errors exclude internals.

## Test plan

- Unit/API: validation, origins, CSRF, cookies, rotation/clearing, error mapping, credential non-disclosure.
- Integration: existing repository replay suite.
- Full gate: `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No production deployment/configuration, destructive migration, secret changes, weakened cookies/CSRF/tests, or core invariant changes.
