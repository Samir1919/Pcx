# Task: E1 Auth Audit and Runtime Composition

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-auth-runtime-composition-v2`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0002, ADR 0003

## Objective

Provide durable PostgreSQL auth-audit writes, a bounded local abuse-control adapter, trusted-origin parsing, and one explicit composition root for the E1 auth stack.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/SECURITY_ARCHITECTURE.md` sections 4, 7, 14, and 16
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` sections 24 and 27
- ADR 0002 and ADR 0003
- E1 auth service/HTTP handoffs

## Scope

- Append auth events to `auth_audit_events` through parameterized SQL.
- Bound action/outcome/request/target inputs and exclude arbitrary changes/secrets.
- Add a deterministic in-memory fixed-window limiter explicitly scoped to local/test/single-process use.
- Parse and validate exact HTTP(S) origins.
- Compose repository, audit, limiter, auth service, and HTTP handler options.

## Non-scope

- Production/distributed limiter, atomic auth-state/audit outbox, production secrets/origins, contact flows, deployment, or schema changes.

## Domain invariants affected

- Authentication state remains PostgreSQL-backed and server-owned.
- Audit records are append-only through this adapter and contain no raw credentials/passwords.

## Acceptance criteria

- [x] Audit adapter emits one parameterized insert with bounded canonical event data.
- [x] Limiter fails closed for absent client keys and deterministically resets windows.
- [x] Origin parser rejects credentials, paths, queries, fragments, and non-HTTP schemes.
- [x] Composition requires a PostgreSQL pool and at least one trusted origin.
- [x] Composed service uses the accepted repository/service/HTTP contracts.

## State/API/schema/UI impact

No new endpoints/schema/UI; adds runtime adapters and composition exports.

## Security and privacy review

Audit inputs are allow-listed and values bounded. Network keys are already hashed at the HTTP boundary. The limiter has explicit memory bounds but is not multi-instance production enforcement. Runtime configuration fails closed without a pool/origins.

## Test plan

- Unit tests for SQL parameters, input rejection, limiter behavior, origin parsing, and composition.
- Existing auth HTTP/service and repository integration suites.
- Full gate: `npm run verify`.

## Migration and rollback

None; uses existing `auth_audit_events` table.

## Prohibited changes / hard stops

No production configuration/deployment, destructive migration, plaintext secrets, audit bypass, or representation of the local limiter as production-ready.
