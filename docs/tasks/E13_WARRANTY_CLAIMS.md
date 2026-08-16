# Task: E13 Warranty & Claims

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E13 — Warranty & claims
- Related ADRs: ADR 0001, ADR 0002

## Objective

Issue one warranty per sold order item and track warranty claims through a server-owned lifecycle with typed resolutions.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 14)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`

## Scope

- Domain: `Warranty` (unique per order item), `Claim`, `ClaimResolution`.
- Migration `0016_warranty_claims.sql`: `warranties` (unique per order item) + `claims` + `claim_resolutions`.
- Repository/service/HTTP: `INVENTORY_MANAGE`/`SYSTEM_CONFIGURE`-gated warranty/claim/resolution.

## Non-scope

- Warranty policy authoring, claim inspections, carrier pickup, cost accounting.

## Domain invariants affected

- One warranty per sold order item; warranty has a valid time window.
- Claim resolution types are restricted; resolution is recorded with approving identity.

## Acceptance criteria

- [x] Warranty ACTIVE with valid window and one-per-item uniqueness.
- [x] Claims only against ACTIVE warranty.
- [x] Resolutions are typed and settle once.
- [x] `INVENTORY_MANAGE`/`SYSTEM_CONFIGURE` required.
- [x] CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/admin/warranties`, `POST /api/v1/admin/claims`, `POST /api/v1/admin/claims/resolve`. Adds migration `0016`.

## Security and privacy review

`hasPermission` default deny; exact-origin + CSRF; server-owned lifecycle; resolution approved-by identity captured.

## Test plan

- Domain: warranty window, claim lifecycle, resolution typing.
- Service: permission, ACTIVE-warranty claim gate, resolution.
- HTTP: CSRF/origin, 201/200/403/405/409/422/503.
- Integration: warranty→claim→resolution persistence, settle-once.

## Migration and rollback

Additive migration `0016_warranty_claims.sql`.

## Prohibited changes / hard stops

No client-owned status/amount, no production deployment.
