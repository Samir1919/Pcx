# Task: E6 Acquisition, Cost & Final Offer

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E6 — Acquisition, cost & final offer
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Establish the financial chain: valuation (estimate) → final offer → acceptance → immutable acquisition with idempotency, while never letting an estimate be treated as a final offer.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 5)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Section 8, 16, 23)
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`

## Scope

- Domain: `Valuation`, `Offer`, `Acquisition` with server-owned status/amount and idempotency key.
- Migration `0010_acquisition.sql`: `valuations`, `offers`, `acquisitions` with range/immutability/idempotency constraints.
- Repository/service/HTTP: `PRICING_MANAGE`/`ACQUISITION_PAYMENT_MANAGE`-gated valuation/offer/acceptance/acquisition.

## Non-scope

- Actual payment processing, cost allocation (refurbishment/testing), seller accept/reject endpoints, notifications.

## Domain invariants affected

- Estimated range ≠ final offer; valuation range and recommended value are validated.
- Accepted acquisition amount is server-owned and immutable.
- Acquisition is idempotent; same key cannot create a duplicate financial record.

## Acceptance criteria

- [x] Valuation enforces low ≤ high and recommended within range.
- [x] Only ACTIVE offers can be accepted (expiry enforced).
- [x] Acquisition agreedPrice is derived from the accepted offer (not client-supplied).
- [x] Idempotency key enforces single acquisition per request.
- [x] Permission-gated and CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/admin/valuations`, `POST /api/v1/admin/offers`, `POST /api/v1/admin/offers/:id/accept`, `POST /api/v1/admin/acquisitions`. Adds migration `0010`. No UI change.

## Security and privacy review

`hasPermission` default deny; exact-origin + CSRF; amounts are server-owned (offer-driven), never client author; idempotency key guarded by DB unique constraint.

## Test plan

- Domain: valuation range, offer lifecycle, acquisition immutability/idempotency.
- Service: permission, ownership, idempotent replay, state rejection.
- HTTP: CSRF/origin, 201/403/405/409/422/503.
- Integration: full valuation→offer→accept→acquisition chain + duplicate idempotency key rejection.

## Migration and rollback

Additive migration `0010_acquisition.sql`.

## Prohibited changes / hard stops

No payment provider/credentials, no client-owned price/amount, no production deployment.
