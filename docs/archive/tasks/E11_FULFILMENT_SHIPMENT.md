# Task: E11 Fulfilment & Shipment

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E11 — Fulfilment & shipment
- Related ADRs: ADR 0001, ADR 0002

## Objective

Create shipments for paid orders and track DRAFT→SHIPPED→DELIVERED lifecycle with a courier provider name and tracking id.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 13)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`

## Scope

- Domain: `Shipment` lifecycle, `ShipmentEvent`.
- Migration `0014_shipments.sql`: `shipments` (unique tracking id, lifecycle constraints) + `shipment_events`.
- Repository/service/HTTP: `INVENTORY_MANAGE`/`SYSTEM_CONFIGURE`-gated create/ship/deliver.

## Non-scope

- Courier sandbox adapter/webhook, packaging evidence media, return-to-origin.

## Domain invariants affected

- Shipment status is server-owned; DRAFT→SHIPPED requires a tracking id; SHIPPED→DELIVERED requires prior ship.
- Tracking id is unique.

## Acceptance criteria

- [x] Create returns DRAFT; negative weight/amount rejected.
- [x] SHIPPED requires tracking id; DELIVERED requires SHIPPED.
- [x] Events recorded on ship and deliver.
- [x] Tracking id uniqueness enforced.
- [x] Permission-gated + CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/admin/shipments`, `POST /api/v1/admin/shipments/:id/ship`, `POST /api/v1/admin/shipments/:id/deliver`. Adds migration `0014`.

## Security and privacy review

`hasPermission(identity, INVENTORY_MANAGE|SYSTEM_CONFIGURE)` default deny; exact-origin + CSRF; no financial amounts beyond COD/shipping charge.

## Test plan

- Domain: lifecycle, negative amounts.
- Service: permission gate, state transitions, events.
- HTTP: CSRF/origin, 201/200/405/409/422/503.
- Integration: draft→ship→deliver chain, event persistence, tracking uniqueness.

## Migration and rollback

Additive migration `0014_shipments.sql`.

## Prohibited changes / hard stops

No courier provider credentials, no client-owned status/tracking authority, no production deployment.
