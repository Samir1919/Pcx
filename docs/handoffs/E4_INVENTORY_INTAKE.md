# Agent Handoff: E4 Physical Intake & Inventory Identity

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Authorized staff can register a physical used item as a server-owned RECEIVED `InventoryItem` with normalized serial identifiers. Duplicate physical identities (same `identifier_type` + normalized value) are blocked at the database constraint and surfaced as 409.

## Changed areas

- `packages/domain/src/inventory/inventory-item.mjs`: `InventoryItem`, `SerialIdentifier`, normalization, primary assertion.
- `packages/domain/src/index.mjs`: exports inventory contracts.
- `apps/api/migrations/0008_inventory.sql`: additive `inventory_items` + `serial_identifiers` with duplicate/primary uniqueness.
- `apps/api/src/modules/inventory/postgres-inventory-repository.mjs`, `inventory-service.mjs`, `inventory-http.mjs`: transactional intake + permission-gated list/get + HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `apps/api/src/server.mjs`: runtime wiring/routing.
- Tests: domain `inventory-item`, service `inventory-service`, HTTP `inventory-http`, integration `inventory-repository`; migrations test updated.

## Acceptance criteria

- [x] Intake returns a server-owned RECEIVED record with normalized primary serial.
- [x] Only `INVENTORY_MANAGE` roles can intake/list/get.
- [x] Duplicate serial identifier is rejected.
- [x] Unknown fields, invalid status/type, missing primary rejected.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 116 application/unit, 0 failures |
| `npm run test:integration` | Pass: 11/11 (incl. inventory repository) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 116 unit + 11 integration + 1 smoke |

## Architecture/security review

`hasPermission(identity, INVENTORY_MANAGE)` default deny; exact-origin + CSRF on writes; serial normalization prevents casing/whitespace duplicate identities. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0008_inventory.sql`.

## Remaining work and next safe action

1. E4 inventory lifecycle transitions (inspection → approved/rejected) and PCX ID generation.
2. E8 search/discovery storefront.
3. E5 inspection/verification templates.

## Blockers requiring human decision

None.
