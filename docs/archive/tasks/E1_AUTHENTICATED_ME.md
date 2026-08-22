# Task: E1 Authenticated Self Identity

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-authenticated-me`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Expose `GET /api/v1/me` backed by hashed opaque access-session lookup and a minimal safe self-identity DTO.

## Scope

- Authenticate `pcx_access` cookie through repository lookup.
- Return user ID, status, verification state, and roles only.
- Stable 401/405/503/non-leaking errors.

## Non-scope

- Profile/contact fields, updates, addresses, MFA completion, admin lookup.

## Acceptance criteria

- [x] Missing/invalid/revoked access returns identical 401.
- [x] Raw access credential never reaches persistence or response.
- [x] Safe self DTO contains only allow-listed fields.
- [x] Route permits GET only and fails closed without auth service.

## Security and test plan

Cookie-only server authentication, SHA-256 persistence lookup, DTO allow-list tests, full verify.

## Migration and rollback

None.

## Prohibited changes / hard stops

No public identity exposure, contact/credential leakage, or authorization bypass.
