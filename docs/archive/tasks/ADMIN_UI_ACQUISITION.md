# Task: Admin UI — Acquisition Workflow

- Status: Complete
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium (financial-adjacent)
- Related epic: E6 (acquisition) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing acquisition write endpoints in the admin panel: create
valuation, create offer, accept offer, create acquisition, mark acquisition paid.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (valuations, offers, acquisitions)
- apps/api/src/modules/acquisition/acquisition-service.mjs

## Scope

- Admin client: `apps/admin/lib/acquisition-api.js` (createValuation, createOffer,
  acceptOffer, createAcquisition, markAcquisitionPaid).
- Admin UI: `/acquisition` workspace with forms (manual IDs, since the API
  currently exposes no list/get for these resources).
- Admin nav: add "Acquisition" entry.

## Non-scope

- Backend list/get endpoints (deferred; not in current API surface).
- Seller accept/reject endpoints, real payment gateway.

## Domain invariants affected

- Valuation is an immutable estimate; offer is final and server-owned.
- Acquisition agreedPrice is derived from the accepted offer (never client-set).
- Acquisition payment is PENDING→PAID server-owned transition.

## Acceptance criteria

- [ ] Admin can invoke all five acquisition endpoints from the UI.
- [ ] Client never sets agreedPrice/status; amount only on valuation/offer inputs.
- [ ] Server errors (invalid state/not found) surface in UI.

## Security and privacy review

- Origin + CSRF double-submit gate (all POST).
- PRICING_MANAGE/ACQUISITION_PAYMENT_MANAGE enforced server-side.
- No financial amount is authoritative from the client beyond invite/offer inputs.

## Test plan

- Unit: admin acquisition-api sends correct paths and omits server-owned fields.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, payment-destination/credential change.
- No client-derivation of agreed price or payment status.
