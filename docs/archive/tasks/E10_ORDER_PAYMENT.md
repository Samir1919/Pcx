# Task: E10 Order & Payment

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E10 — Order & payment
- Related ADRs: ADR 0001, ADR 0002

## Objective

Create orders with server-computed totals and sold-fact snapshots, and record payments with idempotency via a unique provider transaction id.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Sections 11, 12)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (Sections 17, 21, 23)

## Scope

- Domain: `Order`, `OrderItemSnapshot`, `Payment` (server totals, immutable snapshots, idempotent status).
- Migration `0013_orders_payments.sql`: `orders`, `order_items`, `payments` with total invariant and unique provider txn.
- Repository/service/HTTP: customer-gated order creation, payment record/confirm.

## Non-scope

- Actual payment gateway/webhook processing, refunds, fulfilment.

## Domain invariants affected

- Order totals are server-computed; client never authors price/totals.
- Order items snapshot the sold facts.
- Payment provider transaction id is unique and idempotent.

## Acceptance criteria

- [x] Order total = subtotal + shipping - discount, non-negative.
- [x] Order items reject negative price and snapshot sold facts.
- [x] Payment duplicates by provider txn map to conflict (409).
- [x] Payment confirms only from INITIATED, once.
- [x] Customer role required; CSRF/origin protected.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/orders`, `POST /api/v1/payments/confirm`. Adds migration `0013`.

## Security and privacy review

Customer role required; exact-origin + CSRF; server-owned totals; unique provider txn id enforcement at DB; payment status server-owned.

## Test plan

- Domain: totals, snapshot, payment lifecycle.
- Service: permission, totals derivation, duplicate/conflict, confirm state.
- HTTP: CSRF/origin, 201/200/405/409/422/503.
- Integration: order+item+payment persistence, duplicate txn rejected, confirm idempotency.

## Migration and rollback

Additive migration `0013_orders_payments.sql`.

## Prohibited changes / hard stops

No payment provider/credentials, no client-owned price/amount, no production deployment.
