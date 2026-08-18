# Task: Admin/Web CRUD & List Improvements

- Status: In progress
- Owner/agent: Cline (autonomous continuation)
- Branch: `agent/admin-web-crud-list-improvements`
- Risk: Medium (admin UI surface, some new read-only backend endpoints)
- Related epic: E2, E3, E4, E11, E12, E13, E15, E8
- Related ADRs: 0001, 0002, 0003, 0006

## Objective

Close admin UI CRUD/read gaps by (1) replacing `window.prompt` catalog edits with full typed edit modals, (2) surfacing existing backend list/read endpoints in admin workspaces, and (3) adding read-only list endpoints where action-only workspaces are blind.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/domain-rules.md`, `docs/brain/ui-ux.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`

## Scope

- Catalog: full-field edit modal for categories/brands/product-models/attribute-definitions (key/dataType stay immutable).
- Acquisition workspace: read-only sell-request list.
- Inventory workspace: read-only per-item detail.
- Read-only admin list endpoints + UI tables for shipments, returns, warranty/warranty-claims/claims, notifications.

## Non-scope

- Free CRUD (update/delete) on server-owned lifecycle records (listings, shipments, returns, warranty claims, acquisition payments).
- Real payment/courier/notification providers.
- Production deployment or destructive migrations.

## Domain invariants affected

- "Client input never authoritatively sets price, totals, role, status, grade, or warranty eligibility." — edits pass raw fields only; server validates/derives status/grade.
- "State transitions and authorization are enforced on the server." — UI only reads/writes through typed endpoints; no client-owned status.

## Acceptance criteria

- [ ] Catalog edit uses a modal and can edit all server-supported fields per resource.
- [ ] Acquisition workspace shows sell requests.
- [ ] Inventory item detail is reachable.
- [ ] Shipment/return/warranty/notification workspaces show read-only lists.
- [ ] `npm run verify` passes; no `window.prompt` remains in admin workspaces.

## State/API/schema/UI impact

- New `GET` list endpoints (read-only). No schema change.

## Security and privacy review

- All new endpoints gated by existing RBAC permissions (AUDIT_READ/SYSTEM_CONFIGURE/INVENTORY_MANAGE as appropriate).
- No serial/cost/private evidence exposed beyond existing rules.
- No client-owned status/price.

## Test plan

- Unit: admin lib adapters; backend service list methods.
- Integration: new list endpoints.
- Full gate: `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- No weakening of tests/security; no production deploy; no destructive migration; no real secrets.
