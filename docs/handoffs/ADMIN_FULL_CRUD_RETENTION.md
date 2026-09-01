# Handoff: Admin full CRUD + data retention (2026-09-01)

Completes the admin CRUD sweep + a bounded data-retention job. All committed,
pushed, merged into `origin/main`.

## What shipped (5 slices)

### Slice 1 — Catalog hard delete (unreferenced) + archive fallback
- `DELETE /api/v1/admin/:kind/:id?purge=1` hard-deletes categories/brands/
  product-models. A referenced row trips FK RESTRICT → 409 `CATALOG_IN_USE`
  (savepoint-guarded, never a cascade). Admin UI shows Delete + Archive buttons.
- Fixed a pre-existing async `event.currentTarget.reset()` bug in the create form.

### Slice 2 — Listings lifecycle: pause/unpublish/archive
- Domain `pauseListing`/`unpublishListing`/`archiveListing` + repo/service/HTTP
  (`POST /admin/listings/:id/pause|unpublish|archive`) + status-aware UI buttons.
- Archive is a soft-delete; terminal RESERVED/SOLD listings cannot be archived.

### Slice 3 — Payment/notification provider delete
- `DELETE /admin/payment-providers/:provider/config/:mode` and the notification
  equivalent hard-remove a stored provider+mode config (active removal = fail
  closed). Admin Delete credentials buttons.
- Fixed the same async `currentTarget.reset()` bug in both provider save forms.

### Slice 4 — Scheduled export delete (cancel)
- `DELETE /admin/scheduled-exports/:id` removes the registry row (worker reads
  enabled rows only, so future runs stop). Admin Reports table gains Delete.

### Slice 5 — Data retention job + ADR 0015
- Worker `retentionService` (24h throttle) purges safe-to-delete obsolete rows:
  closed reservations, delivered/failed notifications, expired/revoked sessions,
  closed offers. Never financial/legal, inventory, inspections, or audit events.
- `docs/adr/0015-data-retention.md`.

## Form rule
All new multi-field create/edit flows use a labeled `<form>`; single-field row
actions (Delete/Archive/Pause/etc.) remain buttons. Server-owned values stay
read-only.

## Tests / gates
- Full suite: 679 tests, 677 pass, 2 fail (pre-existing shared-DB pollution in
  sell-request/sell-taxonomy, unrelated to this work).
- `npm run lint`, `typecheck`, `ui-guard` all pass; each UI slice has headed
  browser evidence in `docs/verify/browser-verify.json`.

## Never hard-deleted (invariant-protected)
Inventory items, orders/payments, returns, inspections, audit logs, acquisitions.
