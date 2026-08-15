# Security

Default deny for privileged operations. Object-level authorization is required in addition to role checks. Sessions, refresh, password reset, contact verification, privileged MFA, rate limits, CSRF/CORS, upload isolation, masked public DTOs, audit logging, and idempotency must follow the approved threat model.

Auth/RBAC, payment/refund, PII, uploads, public passport, secrets, and callbacks require explicit security review. Production/deployment hard stops in `AGENTS.md` are absolute.

Full source: `../specifications/SECURITY_ARCHITECTURE.md`.
