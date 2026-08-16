# Task: E14 Admin Operations & Reporting

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E14 — Admin operations & reporting
- Related ADRs: ADR 0001, ADR 0002

## Objective

Provide an admin-gated operations dashboard aggregating lifecycle counts and recent orders/sell requests.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`

## Scope

- Reporting service: admin-gated dashboard.
- Repository: counts + recent orders/sell requests.
- HTTP: `GET /api/v1/admin/reports/operations` (AUDIT_READ/SYSTEM_CONFIGURE).

## Non-scope

- Full BI/reporting UI, scheduled exports, per-module operational screens.

## Domain invariants affected

- Reports read-only; no mutation; counts are aggregates only.

## Acceptance criteria

- [x] Dashboard requires `AUDIT_READ` or `SYSTEM_CONFIGURE`.
- [x] Returns counts (customers/active listings/pending returns/open claims) and recent rows.
- [x] Read-only GET; no query params.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `GET /api/v1/admin/reports/operations`. No schema change.

## Security and privacy review

`hasPermission` default deny (AUDIT_READ/SYSTEM_CONFIGURE); read-only; aggregates only, no PII in counts.

## Test plan

- Service: permission gate, dashboard shape.
- HTTP: method/query validation, 200/403/405/503.
- Integration: counts and recent rows return bounded values.

## Migration and rollback

None (reads existing tables).

## Prohibited changes / hard stops

No data mutation, no production deployment.
