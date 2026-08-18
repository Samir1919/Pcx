# Task: Admin UI — Inventory Intake

- Status: In progress
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-inventory-intake`
- Risk: Medium
- Related epic: E4 (physical intake) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing physical inventory intake endpoint in the admin panel:
a form on the Inventory page to register a new physical item (product model +
primary serial) as a server-owned RECEIVED InventoryItem.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (inventory_items, serial_identifiers)
- apps/api/src/modules/inventory/inventory-service.mjs (intake contract)

## Scope

- Admin client: add `intakeInventory(body)` to `apps/admin/lib/ops-api.js`.
- Admin UI: add intake form to `apps/admin/app/(workspace)/inventory/page.js`.

## Non-scope

- Inspection, status transitions, PCX ID auto-generation, cost allocation.
- Backend changes (intake endpoint already exists).

## Domain invariants affected

- A physical used item has one unique lifecycle identity (RECEIVED, server-owned).
- ProductModel and InventoryItem remain separate concepts.
- Serial identifiers are normalized and one must be primary (server-enforced).

## Acceptance criteria

- [ ] Admin can submit an intake form; it calls `POST /api/v1/admin/inventory`.
- [ ] Client does not send server-owned status; status stays server-owned.
- [ ] Duplicate serial maps to a visible 409 error in the UI.

## Security and privacy review

- Uses existing Origin + CSRF double-submit gate (non-GET).
- INVENTORY_MANAGE enforced server-side (no client privilege assumption).
- No serial/cost disclosure beyond what admin intake already authorizes.

## Test plan

- Unit: admin ops-api intake sends correct method/path and omits client status.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, credential/payment-destination change.
- No client-owned status or duplicate-serial bypass.
