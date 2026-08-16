# Task: E2 Authorized Audited Catalog Updates

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-admin-catalog-updates`
- Risk: Security-sensitive
- Related epic: E2
- Related ADRs: ADR 0002, ADR 0003

## Objective

Complete active category/brand/ProductModel admin PATCH commands with least-privilege authorization, domain revalidation, and atomic audit.

## Scope

- Owner-controlled field allow-lists and partial merge.
- Active-record-only lookup/update; archived records remain historical.
- Atomic PostgreSQL update and audit.
- Authenticated origin/CSRF-protected PATCH item routes.

## Non-scope

- Unarchive, destructive delete, specification administration, UI.

## Acceptance criteria

- [x] Client cannot update ID/status/timestamps/actor/audit/sensitive model facts.
- [x] Partial updates revalidate complete domain records.
- [x] Archived/missing records share not-found.
- [x] Update and audit commit atomically.
- [x] PATCH uses existing catalog:manage and browser write controls.

## Migration and rollback

None.

## Prohibited changes / hard stops

No unarchive/destructive delete, production action, permission broadening, or physical/commercial model facts.
