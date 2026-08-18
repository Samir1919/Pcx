# Task: Admin UI — Shipment Management

- Status: In progress
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium
- Related epic: E11 (fulfilment & shipment) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing shipment endpoints in the admin panel: create, ship, deliver.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (shipments)
- apps/api/src/modules/logistics/shipment-service.mjs

## Scope

- Admin client: `apps/admin/lib/shipment-api.js` (create, ship, deliver).
- Admin UI: `/shipment` workspace with forms (manual IDs, since the API exposes
  no list/get for shipments).
- Admin nav: add "Shipment" entry.

## Non-scope

- Courier webhook handling, packaging evidence, return-to-origin.
- Backend list/get endpoints.

## Domain invariants affected

- Shipment lifecycle is server-owned (DRAFT→SHIPPED→DELIVERED).
- Tracking id is server-authoritative (derived from courier, never client-set).

## Acceptance criteria

- [ ] Admin can create, ship, and deliver a shipment from the UI.
- [ ] Client never sends a tracking id or status.
- [ ] Server errors surface in UI.

## Security and privacy review

- Origin + CSRF double-submit gate (all POST).
- INVENTORY_MANAGE/SYSTEM_CONFIGURE enforced server-side.

## Test plan

- Unit: admin shipment-api sends correct paths and omits trackingId/status.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, courier/webhook secret change.
- No client-supplied tracking id.
