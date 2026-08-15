# E1 Identity, Authentication, and RBAC — Slice 1

- Status: In progress
- Branch: `agent/e1-identity-rbac`
- Risk: Security-sensitive

## Scope

Establish framework-neutral identity status contracts, canonical roles and permissions, a default-deny authorization policy, ownership checks, and append-oriented security audit events. Add role-matrix and privilege-escalation tests.

## Non-scope

Password hashing parameters, cookie/token transport, refresh persistence, database migrations, MFA provider, rate-limit backend, UI, and production authentication policy. ADR 0003 remains proposed until those decisions receive security review.

## Acceptance criteria

- Only canonical persisted roles are accepted.
- Unknown permissions and roles fail closed.
- Technician, support, finance, inventory, supervisor, admin, and super-admin separation follows the approved threat model.
- Customer-owned resources require matching owner identity unless an explicit staff permission grants access.
- Role assignment requires a dedicated permission and blocks self-elevation.
- Security audit events include actor, action, target, request ID, timestamp, and safe change metadata.
- Tests cover allowed access, denied access, ownership, unknown input, and privilege escalation.

## Hard-stop boundary

This slice does not choose or change production authentication/security policy, credentials, MFA, or deployment configuration.
