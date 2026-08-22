# Task: E1 Authentication Primitives

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-auth-primitives`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Implement bounded password hashing/verification and opaque access/refresh credential generation/hashing contracts matching accepted ADR 0003.

## Scope

- Argon2id password validation, hash, verify, and rehash detection.
- 32-byte cryptographically random base64url opaque credentials.
- SHA-256 credential hashing to the database's 32-byte format.
- Constant-time credential-hash comparison.
- Central access/refresh lifetime constants and expiry calculation.

## Non-scope

Persistence, HTTP/cookies/CSRF, registration/login, refresh transaction, rate limiting, MFA, reset/contact verification, and production calibration.

## Acceptance criteria

- [x] Passwords are bounded and Argon2id hashes use the accepted minimum parameters.
- [x] Verification fails closed for malformed hashes/input.
- [x] Credentials have at least 256 bits of entropy and raw values are never represented as persistence records.
- [x] Credential hashes are deterministic 32-byte buffers and comparison is constant-time.
- [x] Expiry rules match ADR 0003.

## Security review

Passwords are capped by UTF-8 byte length to reduce hashing DoS. Error behavior does not distinguish malformed hashes from wrong passwords. Raw opaque credentials must be returned only through secure transport in later application code and never logged.

## Migration and rollback

None.

## Prohibited changes / hard stops

No production secrets, cookies, deployment, weaker Argon2 parameters, or plaintext credential storage.
