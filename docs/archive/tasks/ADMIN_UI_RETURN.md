# Task: Admin UI — Return & Refund Management

- Status: Complete
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium (refund-sensitive)
- Related epic: E12 (return & refund) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the admin-side return endpoints in the admin panel: approve, receive, settle refund.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (return_requests)
- apps/api/src/modules/warranty/return-request-service.mjs

## Scope

- Admin client: `apps/admin/lib/return-api.js` (approve, receive, refund).
- Admin UI: `/return` workspace with three action forms (manual IDs).
- Admin nav: add "Returns" entry.

## Non-scope

- Return creation (customer self-service), refund gateway execution, carrier pickup.
- Backend list/get endpoints.

## Domain invariants affected

- Return lifecycle is server-owned (REQUESTED→APPROVED→RECEIVED→REFUNDED).
- One-refundable-request-per-item (double-refund guard) is server-enforced.
- Refund amount is approved via server transition; client only supplies amount on refund.

## Acceptance criteria

- [ ] Admin can approve, receive, and settle refund from the UI.
- [ ] Client never sends return status; refund amount only on refund action.
- [ ] Server errors surface in UI.

## Security and privacy review

- Origin + CSRF double-submit gate (all POST).
- REFUND_MANAGE enforced server-side.
- Financial-sensitive: refund amount is an action input, but transition rules are server-owned.

## Test plan

- Unit: admin return-api sends correct paths; refund body contains only amount.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, refund-gateway/credential change.
- No client-owned lifecycle state.
