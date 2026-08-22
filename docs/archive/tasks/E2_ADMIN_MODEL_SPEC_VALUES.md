# Task: E2 Admin ProductModel Specification Values

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-admin-model-spec-values`
- Risk: Security-sensitive
- Related epic: E2
- Related ADRs: ADR 0001, ADR 0002, ADR 0003, ADR 0004

## Objective

Let authorized catalog administrators view and assign category-compatible typed specification values to ProductModels.

## Source-of-truth references

- `AGENTS.md`
- Approved E2/API/database/user-flow specifications

## Scope

- Authorized read model for persisted ProductModel values.
- Per-model attribute editor filtered to its category.
- TEXT, NUMBER, BOOLEAN and JSON input conversion and audited upsert.
- Model alias editing entry point from the catalog workspace.

## Non-scope

- Public model specification DTO, physical item data, bulk import and inspection templates.

## Domain invariants affected

- Values remain attached to generic ProductModel metadata only.
- Database and domain validation enforce definition category and data type.
- API owns authorization and audit actor.

## Acceptance criteria

- [x] Value reads require an active model and catalog permission.
- [x] Editor exposes only active definitions for the model category.
- [x] Each supported type is converted before the server-validated PUT.
- [x] Existing values load and can be updated without changing their identity.
- [x] Required build/unit/integration gates pass (`npm run verify:ci`: 92 application/unit + 9 PostgreSQL integration tests, 0 failures; Next production build passes).

## State/API/schema/UI impact

Adds authenticated `GET /api/v1/admin/product-models/:id/specifications` and a model specification editor route. No schema change.

## Security and privacy review

Reads and writes require catalog permission. Writes retain exact-origin/CSRF enforcement. IDs are bounded and decoded fail-closed. No private/physical evidence is returned.

## Test plan

- Unit/API: active-model checks, auth routing, URL/CSRF adapter.
- Integration: typed persisted value readback.
- Build: Next production build.
- Full gate: `npm run verify:ci`.

## Migration and rollback

None.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops; no physical-item facts or client-owned authority.
