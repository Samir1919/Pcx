# Task: E1 Provider-Neutral MFA Challenge Verification

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E1 — Identity, authentication & RBAC
- Related ADRs: ADR 0003

## Objective

Complete the provider-neutral MFA flow: after a privileged login returns a challenge, verify the challenge and issue a real session server-side. Enrollment remains deferred until a concrete provider is selected.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/SECURITY_ARCHITECTURE.md` (sections 4, 7, 18)
- `docs/adr/0003-authentication-boundary.md`
- `docs/tasks/E1_PRIVILEGED_MFA_GATE.md`

## Scope

- `POST /api/v1/auth/verify-mfa` accepting `{ challengeId, credential }`.
- Server-side challenge verification via an injected provider (`verifyChallenge`).
- Issue a session and return `{ status: "authenticated", identity, session }` with cookies.
- Fail closed (`MFA_FAILED`) on absent/invalid provider, missing fields, or failed verification.
- CSRF + exact-origin enforcement on the route.

## Non-scope

- Concrete MFA provider/credentials, enrollment/recovery UI, production privileged access.

## Domain invariants affected

- Privileged identities still never receive a password-only session.
- Client never supplies the userId; it is derived from the verified challenge.

## Acceptance criteria

- [x] `verifyMfa` issues a session only after provider returns `{ status: "verified", userId }`.
- [x] Missing/invalid provider and invalid challenge both fail closed with `invalid_mfa`.
- [x] HTTP route enforces CSRF and exact origin, returns session cookies, never reflects the credential.
- [x] Audit does not record the raw MFA credential.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/auth/verify-mfa`. No schema change.

## Security and privacy review

Provider secrets are never observed by the service. The client-supplied identity is ignored; the verified userId is server-derived. MFA credential is not echoed in responses or audit.

## Test plan

- Service: fail-closed without provider; success path issues session and excludes credential from audit.
- HTTP: CSRF required; success returns 3 cookies and safe body.
- Full gate: `npm run verify:ci`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No provider credentials, no MFA bypass, no privileged-role policy weakening, no production access.
