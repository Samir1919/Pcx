# Task: Admin UI — Listing Management

- Status: Complete
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium
- Related epic: Admin operations workspace (E14)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing listing/pricing write endpoints in the admin panel with a
Listing workspace (list, create draft, publish, set price), and add the missing
admin list endpoint so drafts/listings can be seen before managing them.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, state-machines.md, ui-ux.md
- docs/specifications/API_SPECIFICATION_STATE_MACHINES.md (listing publish rules)
- docs/specifications/DATABASE_ERD.md (listings/listing_prices)

## Scope

- Backend: `GET /api/v1/admin/listings` admin list (PRICING_READ gated) returning
  listing + model name + current price, with pagination meta.
- Admin client: `apps/admin/lib/listing-api.js` (list, createDraft, publish, setPrice).
- Admin UI: `/listings` workspace with table + forms.
- Admin nav: add "Listings" entry.

## Non-scope

- List pause/unpause/archive/sold state transitions (not in existing API).
- Public catalog/search changes.
- Inventory item intake (separate slice).

## Domain invariants affected

- Listing status is server-owned (DRAFT → PUBLISHED from DRAFT/PAUSED only).
- Client never authoritatively sets status/price validity; price is server-owned.
- Max one active PUBLISHED listing per inventory item (already DB-enforced).

## Acceptance criteria

- [ ] `GET /api/v1/admin/listings` returns listings with model name + current price.
- [ ] Admin UI lists listings and can create draft, publish, and set price.
- [ ] Publish uses server-owned transition; UI surfaces 409 on invalid state.
- [ ] Tests pass; no client-owned status/price authority.

## Security and privacy review

- Endpoint gated by `PRICING_READ` for list, `PRICING_MANAGE` for writes (existing).
- Writes keep Origin + CSRF double-submit gate.
- No serials, acquisition cost, or private evidence exposed in admin list.

## Test plan

- Unit: listing-service listAdmin gate; listing-http GET route; admin listing-api.
- Integration: listing repository listAdmin.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, credential/payment-destination change.
- No server-side state transition weakening.
