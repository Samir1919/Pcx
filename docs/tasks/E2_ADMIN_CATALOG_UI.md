# Task: E2 Admin Catalog UI Foundation

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-admin-catalog-ui`
- Risk: Security-sensitive
- Related epic: E2
- Related ADRs: ADR 0001, ADR 0003, ADR 0004

## Objective

Deliver the first responsive, API-backed privileged catalog workspace for categories, brands, ProductModels and specification definitions.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`
- `docs/specifications/USER_FLOW_SCREEN_MAP.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`
- `docs/specifications/INFRASTRUCTURE_DEVOPS.md`

## Scope

- Lock and build the approved Next.js admin boundary.
- List/create/edit/archive active E2 catalog records.
- Add authorized specification-definition query support.
- Same-origin authenticated API adapter with CSRF on writes.
- Responsive, keyboard-native loading/empty/error/success states.

## Non-scope

- Login/MFA UI, inspection templates, physical inventory facts, deployment and production configuration.
- Complete model-value editing UX is a follow-up within E2.

## Domain invariants affected

- ProductModel forms exclude serial, acquisition cost, health, grade, price and other physical/commercial facts.
- The API remains authoritative for identity, role, lifecycle and audit actor.
- Archive preserves historical references.

## Acceptance criteria

- [x] Admin app production build is part of the root gate.
- [x] Workspace lists and filters active catalog metadata.
- [x] Authorized users can create, rename and archive E2 catalog records.
- [x] Writes send same-origin credentials and double-submit CSRF.
- [x] Unauthorized/API failures render stable non-leaking feedback.
- [x] Full PostgreSQL verification and final semantic review pass; browser automation was unavailable and is recorded in the handoff.

## State/API/schema/UI impact

Adds a Next.js `/catalog` screen and authenticated `GET /api/v1/admin/attribute-definitions`. No schema change.

## Security and privacy review

Client has no privileged trust. HTTP-only access remains opaque; readable CSRF cookie is echoed only on writes. Definition query authenticates and authorizes server-side. No physical/private evidence is displayed.

## Test plan

- Unit: API adapter credential, CSRF and stable error behavior.
- API: authorized query routing, filter validation and role denial.
- Integration: definition query persistence/filter.
- Build: Next.js production compilation through root build.
- Full gate: `npm run verify:ci`.

## Migration and rollback

None. Remove the admin app files/dependencies and query addition to roll back.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops; no production deployment, security weakening or physical-item data in catalog UI.
