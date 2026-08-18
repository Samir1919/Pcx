# Task: Admin UI — Warranty & Claims Management

- Status: In progress
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium
- Related epic: E13 (warranty & claims) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing warranty/claim endpoints in the admin panel: create warranty,
create claim, resolve claim.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (warranties, claims, claim_resolutions)
- apps/api/src/modules/warranty/warranty-claim-service.mjs

## Scope

- Admin client: `apps/admin/lib/warranty-api.js` (createWarranty, createClaim, resolveClaim).
- Admin UI: `/warranty` workspace with three forms (manual IDs).
- Admin nav: add "Warranty" entry.

## Non-scope

- Warranty policy authoring, claim inspections, cost accounting.
- Backend list/get endpoints.

## Domain invariants affected

- One warranty per sold order item; valid window; claim requires ACTIVE warranty.
- Resolution is typed (REPAIR/REPLACE/REFUND/REJECT) with approving identity (server-owned).

## Acceptance criteria

- [ ] Admin can create warranty, create claim, and resolve claim from UI.
- [ ] Client never sends claim/resolution status; resolution type is a typed input.
- [ ] Server errors surface in UI.

## Security and privacy review

- Origin + CSRF double-submit gate (all POST).
- INVENTORY_MANAGE/SYSTEM_CONFIGURE enforced server-side.

## Test plan

- Unit: admin warranty-api sends correct paths; resolve body contains only typed fields.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, warranty-resolution override of server rules.
- No client-owned lifecycle state.
