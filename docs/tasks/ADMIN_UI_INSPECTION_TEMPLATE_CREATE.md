# Task: Admin UI — Inspection Template Create

- Status: Complete
- Owner/agent: orchestrator (single agent)
- Branch: `agent/admin-ui-listing`
- Risk: Medium
- Related epic: E5 (inspection & verification) / E14 (admin operations)
- Related ADRs: 0004 (Next.js admin web)

## Objective

Add a create form to the Verification page so an admin with SYSTEM_CONFIGURE
can create a versioned, category-scoped inspection template with typed items.

## Source-of-truth references

- AGENTS.md
- docs/brain/api.md, domain-rules.md
- docs/specifications/DATABASE_ERD.md (inspection_templates, inspection_template_items)
- apps/api/src/modules/inspection/inspection-template-service.mjs

## Scope

- Admin client: add `createTemplate(body)` to `apps/admin/lib/ops-api.js`.
- Admin UI: add form to `apps/admin/app/(workspace)/verification/page.js`
  (category select, name, version, and a dynamic typed item list).

## Non-scope

- Inspection execution/results, supervisor override, health scores.
- Backend changes (create endpoint already exists).

## Domain invariants affected

- Inspection templates are versioned, ACTIVE, and category-scoped (server-owned).
- Item codes are canonical lowercase snake_case and unique per template (server).
- Critical items cannot be plain TEXT (server-enforced).

## Acceptance criteria

- [ ] Admin can create a template via the form → `POST /api/v1/admin/inspection-templates`.
- [ ] Client sends only allow-listed fields; no server-owned status/version.
- [ ] Template version is client-supplied (required by contract) but validated server-side.

## Security and privacy review

- Uses existing Origin + CSRF double-submit gate (non-GET).
- SYSTEM_CONFIGURE enforced server-side.

## Test plan

- Unit: ops-api createTemplate sends correct method/path and typed items.
- Full gate: `npm run verify` (unchanged backend, no migration).

## Migration and rollback

None.

## Prohibited changes / hard stops

- No production deploy, destructive migration, credential/payment-destination change.
- No client-side validation that weakens server rules.
