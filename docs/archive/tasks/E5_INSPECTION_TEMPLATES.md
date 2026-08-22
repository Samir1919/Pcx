# Task: E5 Inspection & Verification Templates

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E5 — Inspection & verification
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Establish versioned, category-scoped inspection templates with typed template items as the basis for verifying physical items.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 7)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 10, 18)

## Scope

- Domain: `InspectionTemplate`, `InspectionTemplateItem`, canonical codes, result types, unique-item assertion.
- Migration `0009_inspection_templates.sql`: versioned templates + template items.
- Repository/service/HTTP: `SYSTEM_CONFIGURE`-gated create/list/get.

## Non-scope

- Inspection execution/results, health scores, evidence, technician workflow, supervisor override.

## Domain invariants affected

- Templates are versioned; items are unique per template by canonical code.
- Client never supplies template status; only ACTIVE/ARCHIVED are valid.

## Acceptance criteria

- [x] Create persists an ACTIVE versioned template with unique typed items.
- [x] Only roles with `SYSTEM_CONFIGURE` can create/list/get.
- [x] Critical items cannot be plain TEXT; duplicate codes are rejected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `GET /api/v1/admin/inspection-templates?categoryId=`, `GET /api/v1/admin/inspection-templates/:id`, `POST /api/v1/admin/inspection-templates`. Adds migration `0009`. No UI change.

## Security and privacy review

`hasPermission(identity, SYSTEM_CONFIGURE)` default deny; exact-origin + CSRF on writes; canonical code validation prevents injection; no PII/evidence in template records.

## Test plan

- Domain: canonical code, result type, critical-TEXT rejection, unique codes.
- Service: permission gate, validation, conflict/reference mapping.
- HTTP: CSRF/origin, categoryId requirement, 201/400/404/405/409/422/503.
- Integration: template + item persistence, listing.

## Migration and rollback

Additive migration `0009_inspection_templates.sql`.

## Prohibited changes / hard stops

No inspection-result submission, no client-owned status, no production deployment.
