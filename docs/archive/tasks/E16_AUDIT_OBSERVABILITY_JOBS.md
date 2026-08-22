# Task: E16 Audit, Observability & Jobs

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E16 — Audit, observability & jobs
- Related ADRs: ADR 0001, ADR 0002

## Objective

Add immutable audit logging and an admin-gated read path, plus a schedule-able job/dispatch pattern.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 17)

## Scope

- Migration `0018_audit_logs.sql`: append-only `audit_logs` + entity/actor indexes.
- Repository/service/HTTP: `AUDIT_READ`-gated list of audit logs with entity filters.
- Reuses existing notification `dispatchDue` (jobs) pattern; observability via `/health/live` + `/health/ready`.

## Non-scope

- Full audit retention/rotation, BI dashboards, external SIEM.

## Domain invariants affected

- Audit logs are append-only governance evidence; no mutation from clients.

## Acceptance criteria

- [x] Audit log list requires `AUDIT_READ`.
- [x] Filters by entityType/entityId and returns recent-first bounded rows.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `GET /api/v1/admin/audit-logs`. Adds migration `0018`.

## Security and privacy review

`hasPermission(audit:read)` default deny; snapshots only, no secrets; immutable append-only.

## Test plan

- Service: permission gate + filters.
- HTTP: read-only, 200/403/405/503.
- Integration: persistence + scoped list.

## Migration and rollback

Additive migration `0018_audit_logs.sql`.

## Prohibited changes / hard stops

No mutation of audit rows, no production deployment.
