# Task: E1 Identity Records and Owned Addresses

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-identity-records`
- Risk: Security-sensitive
- Related epic: E1 — Identity, Authentication & RBAC
- Related ADRs: ADR 0003 (Proposed; not accepted or changed by this slice)

## Objective

Create framework-neutral, client-safe customer registration and owned-address domain contracts without choosing password, token, session, persistence, or production authentication policy.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` — Identity & Access
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` — Auth & Identity API
- `docs/specifications/SECURITY_ARCHITECTURE.md` — identity, authorization, data classification, mass-assignment controls
- `docs/adr/0003-authentication-boundary.md`

## Scope

- Customer registration candidate with server-owned status, role, and verification state.
- Normalized optional email/phone with at least one contact required.
- Customer-owned address creation with active-identity and ownership enforcement.
- Immutable domain records and explicit address fields.

## Non-scope

- Password hashing, login, sessions, refresh, MFA, reset/verification tokens, persistence, migrations, HTTP handlers, UI, and production auth policy.

## Domain invariants affected

- Client input cannot authoritatively set role or status; registration always produces `CUSTOMER` and `PENDING_VERIFICATION`.
- Ownership is enforced server-side by deriving the address owner from the authenticated identity.
- Confidential contact/address records are internal domain objects, not public DTOs.

## Acceptance criteria

- [x] Registration requires a valid internal ID and at least one non-empty contact.
- [x] Email is normalized without embedding locale-specific policy.
- [x] Client-supplied role, status, or verification fields cannot elevate a registration candidate.
- [x] Only active customer identities can create their own addresses.
- [x] Address records contain only approved fields and cannot be mutated after creation.
- [x] Tests cover invalid contacts, mass assignment, inactive identity, non-customer identity, required address fields, and ownership.

## State/API/schema/UI impact

Domain contracts only. No schema, HTTP, or UI changes.

## Security and privacy review

The API layer must later validate/rate-limit registration and store confidential contacts securely. This slice prevents role/status mass assignment and derives ownership from the authenticated identity. It deliberately excludes credentials and tokens.

## Test plan

- Unit: registration normalization/defaults; mass-assignment resistance; address validation/ownership/immutability.
- Integration: deferred until persistence/API slice.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

Do not accept ADR 0003, select crypto/session libraries, create production auth configuration, or introduce a migration in this slice.
