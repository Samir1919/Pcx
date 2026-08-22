# Task: E1 Privileged MFA Login Gate

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-privileged-mfa-gate`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Prevent privileged identities from receiving sessions after password-only authentication and expose a provider-neutral MFA challenge integration point.

## Scope

- Server-owned privileged-role policy for supervisor, finance, admin, super-admin.
- Injected MFA challenge provider; fail closed when absent/invalid.
- HTTP 202 challenge response without session cookies.
- Secret-free audit and tests.

## Non-scope

- Concrete MFA provider/credentials, challenge verification endpoint, recovery codes, enrollment UI, production access.

## Acceptance criteria

- [x] Customer login remains unchanged.
- [x] Any privileged role blocks session creation after valid password.
- [x] Missing/invalid provider fails closed without cookies.
- [x] Valid provider returns bounded challenge metadata only.
- [x] Audit excludes password/provider secrets.

## Security and test plan

Role policy is server-owned and default deny; targeted service/HTTP tests plus `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No provider credentials, production privileged access, MFA bypass, or privileged-role policy weakening.
