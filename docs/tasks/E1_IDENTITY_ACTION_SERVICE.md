# Task: E1 Identity Action Application Service

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-identity-action-service`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Orchestrate enumeration-safe contact verification and password reset using single-use credentials and a provider-neutral delivery boundary.

## Scope

- Request/consume contact verification; request/consume password reset.
- Fixed token lifetimes, opaque credential hashing, password policy, abuse/audit controls.
- Coarse public outcomes and delivery only for eligible identities.

## Non-scope

- HTTP endpoints, concrete email/SMS provider, MFA, production limiter/configuration.

## Acceptance criteria

- [x] Request outcomes do not reveal contact existence/status.
- [x] Only hashes reach persistence and raw tokens only reach delivery.
- [x] Verification/reset failures collapse to stable invalid-token errors.
- [x] Reset uses accepted Argon2id password policy.
- [x] Abuse and audit paths contain no raw password/token.

## Security and test plan

Unit-test all outcomes, redaction, lifetimes, eligibility, and error collapse; run `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No provider credentials, production delivery, enumeration leaks, or policy weakening.
