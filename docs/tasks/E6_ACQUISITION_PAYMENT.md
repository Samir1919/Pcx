# Task: E6 Acquisition Payment (server-owned PENDING → PAID)

- Status: In progress
- Owner/agent: Cline orchestrator
- Branch: `main`
- Risk: Low
- Related epic: E6 — Acquisition, cost & final offer
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Add the server-owned acquisition payment transition: an acquisition created as `PENDING` can be marked `PAID` by an authorized operator. This mirrors the order-payment `confirmPayment` pattern and keeps payment state server-owned (client never sets it).

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`
- `docs/handoffs/E6_ACQUISITION_OFFER.md` (remaining work: "E6 acquisition payment (server-owned status transition PENDING → PAID) and cost allocation")
- `apps/api/src/modules/commerce/order-payment-service.mjs` (reference pattern)

## Scope

- Domain: `markAcquisitionPaid` transition (PENDING → PAID only).
- Repository: `markPaid(acquisitionId, now)` atomic update.
- Service: `markAcquisitionPaid(accessCredential, acquisitionId)`.
- HTTP: `POST /api/v1/admin/acquisitions/:id/pay`.
- Tests: domain, service, HTTP.

## Non-scope

- Real payment provider/gateway integration (hard stop).
- Cost allocation ledger.
- Seller-facing payout endpoints.

## Domain invariants affected

- Payment state is server-owned; client never sets `paymentStatus`.
- Only a `PENDING` acquisition can transition to `PAID` (idempotent-safe, no double-pay).

## Acceptance criteria

- [x] `markAcquisitionPaid` only allows PENDING → PAID.
- [x] Repository update is atomic and returns the updated record.
- [x] Service is permission-gated (ACQUISITION_PAYMENT_MANAGE/PRICING_MANAGE).
- [x] HTTP route is CSRF/origin protected and returns 201/200 with the updated record.
- [x] `npm run verify` passes.

## State/API/schema/UI impact

Adds one HTTP route and one domain transition. No schema change (payment_status column already exists).

## Security and privacy review

Server-owned payment transition. No client-authored amount/status. CSRF/origin protected.

## Test plan

- Domain: PENDING→PAID ok; PAID→PAID rejected; invalid status rejected.
- Service: permission gate, not-found, invalid-state.
- HTTP: route match, CSRF/origin enforcement.

## Migration and rollback

None (no schema change).

## Prohibited changes / hard stops

No real payment provider credentials, no client-owned payment state, no production deployment.
