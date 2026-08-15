# ADR 0003: Server-side authentication and authorization boundary

- Status: Accepted
- Date: 2026-08-16

## Context

E1 requires sessions, refresh, role/permission policy, object ownership, privileged MFA integration, and auditability.

## Decision

Keep identity and policy enforcement inside the API modular monolith. PostgreSQL is the identity/session source of truth, accessed through the `pg` driver and versioned additive SQL migrations. Passwords use the `argon2` package in Argon2id mode; the initial development baseline is 19 MiB memory, 2 iterations, parallelism 1, with production calibration required before launch. Password input is bounded to limit denial-of-service risk.

Use 32-byte cryptographically random opaque credentials. Store only SHA-256 credential hashes. Access sessions expire after 15 minutes. Rotating refresh credentials expire after 30 days; reuse of a replaced refresh credential revokes its entire session family. Browser transport uses Secure, HttpOnly, SameSite cookies and CSRF protection for state changes. Role and ownership policies compose under default deny.

Privileged MFA is an integration requirement before staging/production access for supervisor, finance, admin, and super-admin roles. Authentication events are audited and abuse-sensitive endpoints require layered rate limiting.

## Approval

Approved by the user on 2026-08-16 after the explicit hard-stop review. This approval does not authorize production deployment, production secrets/credentials, destructive migrations, or customer-data operations.

## Consequences

- Access and refresh credentials are not JWTs and require PostgreSQL-backed lookup/revocation.
- Session rotation and reuse detection require transactional integration tests.
- Migration changes are additive/expand-contract and verified against an ephemeral PostgreSQL service in CI.
- Argon2 parameters remain versioned and may only be raised after measured staging calibration; weakening below this baseline requires a new security review.

## Security reference

The Argon2id baseline follows the OWASP Password Storage Cheat Sheet minimum published at approval time: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>.
