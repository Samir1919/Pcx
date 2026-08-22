# Task: Admin UI — Notification Create

- Status: Complete
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Low
- Related epic: E15 (notifications) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Expose the existing notification create endpoint in the admin panel
(`POST /api/v1/admin/notifications`, SYSTEM_CONFIGURE). Correcting the earlier
audit note: there is no list/get endpoint for notifications in the current API —
only create — so this slice is a create form, not a list screen.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md
- apps/api/src/modules/notification/notification-service.mjs (create contract)

## Scope

- Admin client: `apps/admin/lib/notification-api.js` (create).
- Admin UI: `/notifications` workspace with a create form.

## Non-scope

- Notification list get (no endpoint exists), dispatch UI, concrete providers.
- Backend changes.

## Domain invariants affected

- Notification is created PENDING with a channel; delivery failure never rolls
  back a business transaction (server-owned).

## Acceptance criteria

- [ ] Admin can create a notification → `POST /api/v1/admin/notifications`.
- [ ] Client sends only allow-listed fields; no server-owned status.

## Security and privacy review

- SYSTEM_CONFIGURE enforced server-side.
- Notification payload snapshot is admin-supplied but bounded by server contract.

## Test plan

- Unit: admin notification-api sends correct path and omits status.
- Full gate: `npm run verify`

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, provider credential change.
- No client-owned status.
