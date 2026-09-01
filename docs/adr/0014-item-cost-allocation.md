# ADR 0014: Per-item cost allocation ledger

- Status: Accepted
- Date: 2026-09-01

## Context

A physical inventory item accumulates cost beyond the acquisition price:
refurbishment, testing, packaging, inbound shipping, and other allocations.
The only cost data available was a single `inventory_items.acquisition_cost`
column (migration 0036) set once at intake from the accepted offer. There was
no way to record the remaining per-item cost allocation, and no server-owned
"total cost" surfaced for pricing/reporting.

## Decision

Introduce an append-only `item_costs` ledger owned by the inventory module:

- Columns: `inventory_item_id`, `cost_type`
  (`ACQUISITION | REFURBISHMENT | TESTING | PACKAGING | SHIPPING_IN | OTHER`),
  `amount` (positive), optional `reference`, `recorded_by`, `created_at`.
- The existing `inventory_items.acquisition_cost` column remains the seed for
  the ACQUISITION type; `item_costs` appends the remaining allocation. A
  `cost_type` of `ACQUISITION` is still allowed for acquisition adjustments
  beyond the seed.
- **Server-owned total** for an item is computed in SQL, never authored by a
  client:
  `totalCost = COALESCE(acquisition_cost, 0) + COALESCE(SUM(item_costs.amount), 0)`.
- Write requires `INVENTORY_MANAGE`; read requires `INVENTORY_READ` or
  `INVENTORY_MANAGE`. The `inventoryItemId` comes from the URL path, never the
  request body.
- Endpoints: `GET`/`POST /api/v1/admin/inventory/:id/costs` (registered before
  the inventory resource handler so the `/costs` suffix is not 404'd).
- The operations report surfaces the aggregate cost picture (acquisition,
  allocated, total, and by-type) for reporting.

## Consequences

- `packages/domain` exports `createItemCost`, `ItemCostType`,
  `parseItemCostType`, and `sumItemCosts` (pure, testable).
- Migration `0037_item_costs.sql` creates the ledger with a `cost_type` CHECK
  constraint and an `(inventory_item_id, created_at DESC)` index.
- Inventory detail and the cost ledger endpoints both compute the total
  server-side; the admin UI renders totals read-only and only submits one
  entry's `amount` (never a total).
- No invariant changes: unique lifecycle identity, server-authoritative state,
  and "client input never authoritatively sets price/totals" are preserved.
