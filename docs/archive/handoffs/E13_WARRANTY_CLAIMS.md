# Agent Handoff: E13 Warranty & Claims

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

One warranty is issued per sold order item; warranty claims move through a server-owned REQUESTED→RESOLVED lifecycle with typed resolutions (REPAIR/REPLACE/REFUND/REJECT) and approving identity.

## Changed areas

- `packages/domain/src/warranty/warranty-claim.mjs`: warranty/claim/resolution contracts.
- `packages/domain/src/index.mjs`: exports.
- `apps/api/migrations/0016_warranty_claims.sql`: additive `warranties` (unique per order item) + `claims` + `claim_resolutions`.
- `apps/api/src/modules/warranty/postgres-warranty-claim-repository.mjs`, `warranty-claim-service.mjs`, `warranty-claim-http.mjs`.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `warranty-claim`, service `warranty-claim-service`, HTTP `warranty-claim-http`, integration `warranty-claim-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Warranty ACTIVE with valid window and one-per-item uniqueness.
- [x] Claims only against ACTIVE warranty.
- [x] Resolutions typed and settle once.
- [x] `INVENTORY_MANAGE`/`SYSTEM_CONFIGURE` required.
- [x] CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 192 application/unit, 0 failures |
| `npm run test:integration` | Pass: 19/19 (incl. warranty/claim) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 192 unit + 19 integration + 1 smoke |

## Architecture/security review

`hasPermission` default deny; exact-origin + CSRF; server-owned lifecycle; resolution captured with approving identity. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0016_warranty_claims.sql`.

## Remaining work and next safe action

1. E14 admin operations & reporting.
2. E15 notifications (provider-neutral adapters).
3. E16 audit/observability/jobs.

## Blockers requiring human decision

None.
