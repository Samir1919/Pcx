# Agent Handoff: item_costs cost allocation (E4/E6)

- Status: Complete
- Branch: main
- Latest commit: 2978965
- Date: 2026-09-01

## Outcome

Admin can record per-item cost allocations (ACQUISITION/REFURBISHMENT/TESTING/
PACKAGING/SHIPPING_IN/OTHER) via a multi-field form in the inventory detail
modal. The server computes the total cost in SQL (`acquisition_cost` seed +
`SUM(item_costs)`), surfaces it read-only in the inventory detail and the
operations dashboard, and never accepts a client-authored total.

## Changed areas

- `packages/domain/src/inventory/item-cost.mjs` (new) — `ItemCostType`,
  `createItemCost`, `parseItemCostType`, `sumItemCosts`.
- `packages/domain/src/index.mjs` — export the new contract.
- `apps/api/migrations/0037_item_costs.sql` (new) — append-only ledger.
- `apps/api/src/modules/inventory/postgres-item-cost-repository.mjs` (new) —
  `create`, `listByInventoryItem`, `totalByInventoryItem`, `sumByType`.
- `apps/api/src/modules/inventory/item-cost-service.mjs` (new) — permission
  checks, input validation, server-derived totals.
- `apps/api/src/modules/inventory/item-cost-http.mjs` (new) — `GET`/`POST
  /api/v1/admin/inventory/:id/costs`.
- `apps/api/src/modules/inventory/postgres-inventory-repository.mjs` —
  `findById` now returns `totalCost` (server-computed).
- `apps/api/src/modules/identity/auth-runtime.mjs`, `server.mjs` — wire the
  service and route.
- `apps/api/src/modules/reporting/*` — operations report now includes the
  inventory cost picture (acquisition/allocated/total/byType).
- `apps/admin/lib/ops-api.js`, `apps/admin/app/(workspace)/inventory/page.js`,
  `apps/admin/app/(workspace)/page.js` — cost form + ledger + dashboard stat.
- `scripts/admin-e2e-check.mjs` — headed click-through for the cost flow.
- `docs/verify/browser-verify.json` — headed evidence.

## Acceptance criteria

- [x] Admin records per-item costs (multi-field form) — `POST .../costs`.
- [x] Pricing/reporting surfaces the sum server-side — inventory detail
  `totalCost` + operations report `inventoryCost`; totals never client-authored.
- [x] Acquisition seed (`acquisition_cost`, migration 0036) feeds the total.

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/item-cost.test.mjs` | 3/3 pass |
| `node --test apps/api/test/item-cost-service.test.mjs` | 4/4 pass |
| `node --test apps/api/test/operations-report-service.test.mjs` | pass |
| `node --test apps/api/test/integration/item-cost-repository.test.mjs` | 1/1 pass (DB) |
| `npm test` (unit; integration skipped without TEST_DATABASE_URL) | 568 pass / 28 skip / 0 fail |
| `npm run lint` / `typecheck` / `security` / `ui-guard` | pass |
| `PCX_HEADED=1 node scripts/admin-e2e-check.mjs --evidence` | 29/29 pass |

Note: `npm run build` (`next build` on `@pcx/admin`) fails locally in
`/_global-error` prerender (`Cannot read properties of null (reading
'useContext')`) because the local Node is v26.4.0, outside the supported
`>=24 <25` (`.nvmrc` = 24). This is pre-existing and unrelated to this slice.
`npm test` against the shared local `pcx` DB also shows pre-existing
integration-test state pollution (`sell_build_components.psu.required` and a
notifications FK user) from prior runs; CI uses a fresh `pcx_test` DB.

## Architecture/security review

- New data model recorded in ADR 0014. No invariant changes.
- Write gated by `INVENTORY_MANAGE`, read by `INVENTORY_READ`/`INVENTORY_MANAGE`;
  CSRF + Origin enforced on writes. `recorded_by` is the authenticated actor.
- `inventoryItemId` is URL-scoped; totals are SQL-computed; `amount` must be
  positive (CHECK + domain factory).

## Schema/configuration/deployment

- Migration `0037_item_costs.sql` (additive, non-destructive). Rollback: drop
  the table (dev/staging only; not authorized for production).

## Remaining work and next safe action

- Next dependency-ready slice: refund gateway adapter execution (E12, sandbox).
- Then: real bKash HTTP adapter (E10), E5 inspection follow-ups, E7/E8 passport.

## Blockers requiring human decision

- None for this slice. Production deployment + real provider credentials remain
  hard stops.
