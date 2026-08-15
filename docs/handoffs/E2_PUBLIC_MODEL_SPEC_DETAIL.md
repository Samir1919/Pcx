# Agent Handoff: E2 Public ProductModel Specification Detail

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Public `GET /api/v1/product-models/:id` now includes safe typed specifications. Each specification exposes only `key`, `label`, `dataType`, `unit`, and `value`; internal IDs (`id`, `specificationDefinitionId`) and physical/private fields are never returned.

## Changed areas

- `apps/api/src/modules/catalog/catalog-dto.mjs`: new `toPublicSpecification` projection.
- `apps/api/src/modules/catalog/catalog-service.mjs`: detail use case returns a frozen `specifications` array; original repository port remains backward-compatible (missing method → empty list).
- `apps/api/src/modules/catalog/postgres-catalog-repository.mjs`: `listModelSpecifications(id)` reads active, typed values joined to active definitions.
- `apps/api/test/catalog-api.test.mjs`: public detail safe-spec assertions.
- `apps/api/test/integration/catalog-repository.test.mjs`: repository typed-value readback and empty-list behavior.

## Acceptance criteria

- [x] Public detail includes typed specifications (key/label/type/unit/value).
- [x] Internal IDs are absent from public specification DTOs.
- [x] Archived definitions and physical/private fields never appear.
- [x] Original repository port (without the new method) continues to work.
- [x] `npm run verify:ci` passes (93 application/unit + 9 integration + 1 smoke).

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 93 application/unit (with PostgreSQL), 0 failures |
| `npm run test:integration` | Pass: 9/9 |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 93 unit + 9 integration + 1 smoke |

## Architecture/security review

Projection-only public DTO; no internal record serialization. `id` and `specificationDefinitionId` are omitted. Archived definitions are excluded by the `d.status='ACTIVE'` join. No hard stop bypassed.

## Schema/configuration/deployment

None (no migration or config change).

## Remaining work and next safe action

1. E1 provider-neutral MFA verification/enrollment contract before privileged staging access.
2. E3 Sell-to-PCX request intake foundation after remaining E1/E2 gates.

## Blockers requiring human decision

None.
