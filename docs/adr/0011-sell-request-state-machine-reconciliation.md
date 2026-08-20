# ADR 0011: Sell-Request State Machine Reconciliation

- Status: Accepted
- Date: 2026-08-20

## Context

Two approved specifications describe the Sell-to-PCX request lifecycle with
slightly different status vocabularies:

- `BUSINESS_PRODUCT_REQUIREMENTS.md` §12 lists:
  `DRAFT, SUBMITTED, PRELIMINARY_REVIEW, INSPECTION_REQUIRED, INSPECTING,
  OFFERED, ACCEPTED, REJECTED, EXPIRED, PAID, CANCELLED`.
- `API_SPECIFICATION_STATE_MACHINES.md` §16 defines the full transition graph
  using `REVIEWING` (for §12's `PRELIMINARY_REVIEW`), `INFO_REQUIRED`,
  `REJECTED_BY_SELLER`, `ACQUISITION_PENDING`, and `CLOSED`.

The domain layer already implemented `DRAFT / SUBMITTED / REVIEWING` only, so
the remaining lifecycle was unrepresented server-side.

## Decision

Adopt the §16 transition graph as the canonical server-owned state machine and
unify the vocabulary as follows:

Statuses (canonical):
`DRAFT, SUBMITTED, REVIEWING, INFO_REQUIRED, INSPECTION_REQUIRED, INSPECTING,
OFFERED, ACCEPTED, REJECTED, REJECTED_BY_SELLER, EXPIRED,
ACQUISITION_PENDING, PAID, CLOSED, CANCELLED`.

Transitions:
```
DRAFT → SUBMITTED | CANCELLED
SUBMITTED → REVIEWING | CANCELLED
REVIEWING → INFO_REQUIRED | INSPECTION_REQUIRED | REJECTED | CANCELLED
INFO_REQUIRED → REVIEWING
INSPECTION_REQUIRED → INSPECTING
INSPECTING → OFFERED | REJECTED
OFFERED → ACCEPTED | REJECTED_BY_SELLER | EXPIRED
ACCEPTED → ACQUISITION_PENDING
ACQUISITION_PENDING → PAID
PAID → CLOSED
```

Reconciliation notes:
- §12 `PRELIMINARY_REVIEW` → `REVIEWING` (matches existing domain + §16).
- §12 `REJECTED` is split into `REJECTED` (admin reject) and
  `REJECTED_BY_SELLER` (seller rejects final offer) to preserve the accounting
  distinction between an unworkable request and a declined offer.
- §16 `ACQUISITION_PENDING` and `CLOSED` are added to §12; §12 `CANCELLED` is
  retained as the explicit pre-acquisition cancel state.

## Consequences

- `SellRequestStatus`, `SellRequestTransitions`, `assertSellRequestTransition`,
  and `advanceSellRequest` are the single source of truth in
  `packages/domain/src/acquisition/sell-request.mjs`.
- The `sell_requests.status` check constraint is expanded (migration
  `0031_sell_request_state_machine.sql`); existing rows remain valid.
- An admin-gated transition endpoint enforces the graph server-side.
- §12 should be amended to reference this ADR when next edited.
