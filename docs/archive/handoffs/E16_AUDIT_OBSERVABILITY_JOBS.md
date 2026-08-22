# Agent Handoff: E16 Audit, Observability & Jobs

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Append-only audit logs (`audit_logs`) with `AUDIT_READ`-gated listing (entityType/entityId filters), plus re-use of the notification `dispatchDue` pattern for jobs. Liveness/readiness endpoints remain `/health/live` and `/health/ready`.

## Changed areas

- `apps/api/migrations/0018_audit_logs.sql`: append-only table + indexes.
- `apps/api/src/modules/audit/*`: repository/service/HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: `audit-log-service`, integration `audit-log-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Audit list requires `AUDIT_READ`.
- [x] Filters and returns recent-first bounded rows.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:ci` | Pass: security + build + unit + 22 integration + 1 smoke |

## Architecture/security review

`hasPermission(audit:read)` default deny; immutable append-only; snapshots only, no secrets. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0018_audit_logs.sql`.

## Remaining work and next safe action

1. E17 security hardening.
2. E18 backup/staging/release readiness.

## Blockers requiring human decision

None.
