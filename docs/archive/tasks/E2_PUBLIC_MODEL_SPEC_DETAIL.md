# Task: E2 Public ProductModel Specification Detail

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E2 — Catalog & Product Model
- Related ADRs: ADR 0001, ADR 0002

## Objective

Expose safe typed specification values in the public ProductModel detail response without leaking internal identifiers or acquisition/private evidence.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` — public catalog API and safe DTO separation
- `docs/specifications/SECURITY_ARCHITECTURE.md` — public DTOs separate from internal models

## Scope

- Repository method `listModelSpecifications(modelId)` returning active, category-aligned typed values.
- Public `toPublicSpecification` DTO exposing only key/label/dataType/unit/value.
- `GET /api/v1/product-models/:id` includes a frozen `specifications` array.
- Backward-compatible: repositories implementing the original port still work with an empty specification list.

## Non-scope

- Physical item data, acquisition cost, serials, private evidence, spec write/edit UI, bulk import, search filtering on specs.

## Domain invariants affected

- Public ProductModel detail remains projection-based and never serializes the internal repository record.
- Internal IDs (`id`, `specificationDefinitionId`) are not exposed publicly.

## Acceptance criteria

- [x] Public detail includes typed specifications (key/label/type/unit/value).
- [x] Internal IDs are absent from public specification DTOs.
- [x] Archived definitions and physical/private fields never appear.
- [x] Original repository port (without the new method) continues to work.
- [x] `npm run verify:ci` passes (93 application/unit + 9 integration + 1 smoke).

## State/API/schema/UI impact

Adds `specifications` to `GET /api/v1/product-models/:id`. No schema or UI change.

## Security and privacy review

Public DTO projection excludes `id` and `specificationDefinitionId`, and only exposes `key/label/dataType/unit/value`. No serial, acquisition cost, health, or private evidence is returned.

## Test plan

- HTTP: detail includes safe spec DTO; internal IDs absent; sensitive-field leak prevention.
- Integration: `listModelSpecifications` returns typed value and empty list for a model with no values.
- Full gate: `npm run verify:ci`.

## Migration and rollback

None.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops; no schema change, no private evidence, no production deployment.
