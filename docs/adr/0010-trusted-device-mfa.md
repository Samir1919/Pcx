# ADR 0010: Trusted-device window for privileged MFA

- Status: Accepted
- Date: 2026-08-19

## Context

Privileged roles (SUPERVISOR, FINANCE, ADMIN, SUPER_ADMIN) are blocked from
receiving a session after password-only authentication (ADR 0003, E1 privileged
MFA gate). The provider-neutral challenge keeps this invariant but forces a
one-time code on every sign-in, which is operationally heavy for the admin
control room.

## Decision

After a **successful** privileged MFA verification, the user may opt in to
"remember this device" for a bounded window (30 days). The API issues an opaque
device credential, stores only its SHA-256 hash in a new `trusted_devices`
table, and returns the raw credential in an `HttpOnly`, `SameSite=Strict`
(Secure outside development) cookie scoped to the auth boundary.

On a later sign-in, a valid, unexpired, non-revoked trusted-device credential
that belongs to the same resolved identity satisfies the privileged MFA gate,
so the server issues a session directly (no fresh challenge). The decision to
trust remains server-owned: a client cannot grant itself trust, change roles,
or extend the window.

## Consequences

- MFA is not bypassed: a trusted device is only issued after a verified MFA
  event, and it is always bounded and revocable.
- Device credentials are persisted as 32-byte SHA-256 hashes only; raw values
  never appear in the schema, audit, or logs.
- An additive migration adds the table; existing behavior is unchanged when no
  trusted-device cookie is present or when the user declines the option.

## Security reference

Trusted-device expiry mirrors the 30-day refresh-token lifetime in ADR 0003.
Device trust is revocable by expiry and by future revocation flows (not in this
slice).
