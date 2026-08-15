# Task: E4 Physical Intake & Inventory Identity

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E4 — Physical intake & inventory identity
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Enable authorized staff to register a physical used item as an `InventoryItem` with normalized serial identifiers and reject duplicate physical identities.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 6)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 9, 15)

## Scope

- Domain: `InventoryItem`, `SerialIdentifier`, normalization, primary-identifier assertion.
- Migration `0008_inventory.sql`: `inventory_items` + `serial_identifiers` with duplicate/primary constraints.
- Repository/service/HTTP: authenticated `INVENTORY_MANAGE` intake/list/get with duplicate detection.

## Non-scope

- Inspection, refurbishment, cost allocation, listing, warehouse movements, PCX ID generation.

## Domain invariants affected

- Physical used item has one lifecycle identity; serial uniqueness enforced at DB level.
- Client never supplies server-owned `status`/`pcxItemId` semantics beyond allowed intake fields.

## Acceptance criteria

- [x] Intake returns a server-owned RECEIVED record with normalized primary serial.
- [x] Only roles with `INVENTORY_MANAGE` can intake/list/get.
- [x] Duplicate serial identifier is rejected (409/constraint).
- [x] Unknown fields, invalid status/identifier type, and missing primary are rejected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `GET|POST /api/v1/admin/inventory`, `GET /api/v1/admin/inventory/:id`. Adds migration `0008`. No UI change.

## Security and privacy review

Authorization uses `hasPermission(identity, INVENTORY_MANAGE)` with default deny. Exact-origin + CSRF on writes. Serial normalization prevents duplicate identities that differ only by casing/whitespace.

## Test plan

- Domain: normalization, primary assertion, duplicate and invalid-status rejection.
- Service: permission gate, validation, duplicate constraint mapping.
- HTTP: CSRF/origin, 201/404/405/409/503, malformed id.
- Integration: persistence, duplicate serial constraint, readback.

## Migration and rollback

Additive migration `0008_inventory.sql`; no destructive change.

## Prohibited changes / hard stops

No hard-delete of inventory, no client-owned status/PCX ID, no production deployment.
