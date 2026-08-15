# Task: E2 Authorized Audited Catalog Commands

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-admin-catalog`
- Risk: Security-sensitive
- Related epic: E2
- Related ADRs: ADR 0002, ADR 0003

## Objective

Add least-privilege authenticated category/brand/ProductModel create and archive commands with atomic audit persistence and admin HTTP boundaries.

## Scope

- Add catalog:read/catalog:manage permissions granted only to ADMIN/SUPER_ADMIN.
- Server-owned IDs/status/timestamps through existing domain factories.
- Atomic PostgreSQL create/archive plus append audit.
- POST collections and DELETE item-as-archive admin endpoints with origin/CSRF.

## Non-scope

- Destructive delete, update commands, specification-definition administration, UI, production migration.

## Acceptance criteria

- [x] Non-admin operational/customer roles fail closed.
- [x] Client cannot set status, actor, audit, physical/commercial model facts, IDs, or timestamps.
- [x] Create/archive and audit commit atomically.
- [x] Archive preserves record/history and missing/inaccessible resources are hidden.
- [x] Admin writes require access auth, exact origin, and CSRF.

## Security and test plan

RBAC matrix, mass-assignment denial, PostgreSQL transaction/audit integration, HTTP origin/CSRF/error tests, full `verify:ci`.

## Migration and rollback

Additive permission seed migration `0005_catalog_admin_policy.sql`; no destructive rollback.

## Prohibited changes / hard stops

No destructive catalog delete, production migration/deployment, broad permission reuse, client-owned lifecycle, or physical item facts.
