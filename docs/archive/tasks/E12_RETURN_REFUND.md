# Task: E12 Return & Refund

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E12 — Return & refund
- Related ADRs: ADR 0001, ADR 0002

## Objective

Let customers request a return for a sold item and move it through a server-owned REQUESTED→APPROVED→RECEIVED→REFUNDED lifecycle, while preventing double refunds at the database level.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 14)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`

## Scope

- Domain: `ReturnRequest` lifecycle + refund settlement.
- Migration `0015_return_requests.sql`: unique refundable-per-item partial index + lifecycle constraints.
- Repository/service/HTTP: customer-gated create; `REFUND_MANAGE`-gated approve/receive/refund.

## Non-scope

- Warranty claims, physical intake serial matching UI, carrier pickup, refund gateway execution.

## Domain invariants affected

- Return status is server-owned; refund amount must be non-negative and only from RECEIVED.
- One refundable return per sold order item prevents double refunds.

## Acceptance criteria

- [x] Customer creates REQUESTED for an existing order item; duplicates → 409.
- [x] Only REQUESTED→APPROVED→RECEIVED→REFUNDED transitions allowed.
- [x] `REFUND_MANAGE` required for approve/receive/refund.
- [x] Refund idempotency via one-refundable-per-item index.
- [x] CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/returns`, `POST /api/v1/returns/:id/approve`, `POST /api/v1/returns/:id/receive`, `POST /api/v1/returns/:id/refund`. Adds migration `0015`.

## Security and privacy review

Customer role for request; `REFUND_MANAGE` for settlement; exact-origin + CSRF; DB-enforced single refund per item.

## Test plan

- Domain: lifecycle/negative amounts.
- Service: permission, duplicate/reference, settlement state.
- HTTP: CSRF/origin, 201/200/405/409/422/503.
- Integration: duplicate refundable reject, settle once.

## Migration and rollback

Additive migration `0015_return_requests.sql`.

## Prohibited changes / hard stops

No refund gateway/payment-destination integration, no client-owned status or amount, no production deployment.
