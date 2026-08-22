# Task: E1 Trusted-Device Window for Privileged MFA

- Status: Complete
- Owner/agent: Cline
- Branch: `agent/trusted-device-mfa`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003, ADR 0010

## Objective

After a successful privileged MFA verification, let an admin opt in to "remember this device" for a bounded 30-day window so a later sign-in on the same device does not re-prompt for a one-time code, without weakening the server-owned MFA invariant.

## Source-of-truth references

- `AGENTS.md`
- `docs/adr/0003-authentication-boundary.md`
- `docs/adr/0010-trusted-device-mfa.md`
- `docs/tasks/E1_PRIVILEGED_MFA_GATE.md`
- `docs/tasks/E1_MFA_VERIFICATION.md`

## Scope

- Additive `trusted_devices` table (opaque credential SHA-256 hash, expiry, revocation).
- Server issues a trusted-device credential only after a verified MFA event.
- Server honors a valid trusted-device credential at login to skip the challenge.
- Opt-in "remember this device" checkbox in the admin login MFA step.

## Non-scope

- Device revocation/management UI or endpoints.
- Concrete production MFA provider (still a hard stop).
- Enrollment/recovery UI.

## Domain invariants affected

- "Privileged identities must not receive sessions after password-only auth" remains: trust is issued only after a verified MFA event, is server-derived, bounded, and revocable.

## Acceptance criteria

- [x] Privileged login still returns `mfa_required` without a valid trusted-device credential.
- [x] Privileged login with a valid trusted-device credential issues a session directly.
- [x] `verify-mfa` with `rememberDevice` returns a trusted-device cookie; without it returns no device cookie.
- [x] Raw device credential is never persisted or audited (only its SHA-256 hash).

## State/API/schema/UI impact

- New migration `0029_trusted_devices.sql`.
- `auth-service.mjs` login/verifyMfa, `auth-http.mjs` cookie handling, `postgres-identity-repository.mjs`.
- `apps/admin/app/login/page.js`, `apps/admin/app/auth-provider.js`.

## Security and privacy review

Device credential is opaque (32 bytes base64url), stored only as SHA-256 hash, sent as HttpOnly/SameSite=Strict (Secure outside dev) cookie scoped to `/api/v1/auth`. Client cannot self-grant trust. Expiry bounded to 30 days.

## Test plan

- Unit: `auth-service.test.mjs`, `auth-http.test.mjs`.
- Integration: `trusted-device-repository.test.mjs` + `migrations.test.mjs`.
- Full gate: `npm run verify`.

## Migration and rollback

Additive only. Rollback is drop table (not applied automatically).

## Prohibited changes / hard stops

No MFA bypass, no privileged-role policy weakening, no production deployment, no destructive migration.
