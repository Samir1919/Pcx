# Agent Handoff: Trusted-Device Window for Privileged MFA

- Status: Complete
- Branch: `agent/trusted-device-mfa`
- Related ADR: `docs/adr/0010-trusted-device-mfa.md`
- Related task: `docs/tasks/E1_TRUSTED_DEVICE_MFA.md`
- Date: 2026-08-19

## Outcome

Privileged admin sign-in no longer forces a one-time MFA code on every login.
After a successful MFA verification, the admin may opt in to "remember this
device" for a bounded 30-day window. On a later login from the same device, the
server honors the stored trusted-device credential and issues a session
directly, without a fresh challenge.

The server-owned MFA invariant is preserved: a trusted device is issued only
after a verified MFA event, the credential is opaque (32 bytes base64url), and
only its SHA-256 hash is persisted. Raw credentials never appear in the schema,
audit, or logs.

## Changed areas

- `apps/api/migrations/0029_trusted_devices.sql` — new additive `trusted_devices`
  table (id, user_id, 32-byte credential_hash, expires_at, revoked_at, created_at).
- `apps/api/src/modules/identity/postgres-identity-repository.mjs` — added
  `findActiveTrustedDeviceUserId(credentialHash, now)` and
  `issueTrustedDevice(...)`.
- `apps/api/src/modules/identity/auth-service.mjs` — `login` accepts an optional
  `trustedDeviceCredential` and skips the challenge when it resolves to the same
  identity; `verifyMfa` accepts `rememberDevice` and returns a `device`
  credential when true.
- `apps/api/src/modules/identity/auth-http.mjs` — `verify-mfa` allow-lists a
  boolean `rememberDevice`; login forwards the `pcx_device` cookie; success with
  `rememberDevice` sets an `HttpOnly`/`SameSite=Strict` (Secure outside dev)
  `pcx_device` cookie; logout clears it.
- `apps/admin/app/auth-provider.js` — `verify(credential, rememberDevice)`
  passes the flag to the API.
- `apps/admin/app/login/page.js` — MFA step shows a "Remember this device for 30
  days" checkbox.

## Acceptance criteria

- [x] Privileged login still returns `mfa_required` without a valid
      trusted-device credential.
- [x] Privileged login with a valid trusted-device credential issues a session
      directly.
- [x] `verify-mfa` with `rememberDevice` returns a trusted-device cookie;
      without it returns no device cookie.
- [x] Raw device credential is never persisted or audited (only its SHA-256 hash).

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/auth-service.test.mjs apps/api/test/auth-http.test.mjs` | Pass (24/24) |
| `npm run verify:e0` | Pass (36 required artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass (437 pass, 0 fail, 24 skipped integration) |
| `npm run build` | Pass |
| `npm run security` | Pass (secrets + dependencies + container) |
| `git diff --check` | Clean |

Integration tests (`trusted-device-repository.test.mjs`, updated
`migrations.test.mjs`) require `TEST_DATABASE_URL` and are skipped in the local
run without it, matching the repository convention.

## Architecture/security review

- MFA is not bypassed. Trust is issued only after a verified MFA event and is
  server-derived, bounded, and revocable.
- Device credential is stored only as a SHA-256 hash; the raw value is sent
  exclusively in an `HttpOnly`, `SameSite=Strict` cookie scoped to
  `/api/v1/auth`, and `Secure` outside development.
- No privileged-role policy, invariant, or source-of-truth changed.

## Schema/configuration/deployment

Additive migration `0029_trusted_devices.sql`; no env or config change. No
production deployment or real provider credentials involved.

## Remaining work and next safe action

1. Device revocation/management UI and endpoints (out of scope for this slice).
2. Concrete production MFA provider remains a hard stop.
3. Merge `agent/trusted-device-mfa` to `main` after review, then push.

## Blockers requiring human decision

None for this slice.
