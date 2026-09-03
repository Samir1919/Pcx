# ADR 0016: Sell-Request Inspection After Offer Acceptance

- Status: Accepted
- Date: 2026-09-03

## Context

The canonical sell-request lifecycle (ADR 0011, `API_SPECIFICATION_STATE_MACHINES.md`
§16) placed physical inspection before the final offer:

```
REVIEWING → INSPECTION_REQUIRED → INSPECTING → OFFERED → ACCEPTED → ACQUISITION_PENDING
```

Product direction changed: the admin now makes an offer during review, the seller
accepts it, and only then is the physical item inspected before acquisition and
payment. This matches the common recommerce model (offer → accept → verify →
settle).

## Decision

Reorder the sell-request transition graph so inspection follows acceptance:

```
DRAFT → SUBMITTED | CANCELLED
SUBMITTED → REVIEWING | CANCELLED
REVIEWING → OFFERED | INFO_REQUIRED | REJECTED | CANCELLED
INFO_REQUIRED → REVIEWING
OFFERED → ACCEPTED | REJECTED_BY_SELLER | EXPIRED
ACCEPTED → INSPECTION_REQUIRED
INSPECTION_REQUIRED → INSPECTING
INSPECTING → ACQUISITION_PENDING | REJECTED
ACQUISITION_PENDING → PAID
PAID → CLOSED
```

- Offer creation now auto-advances the request `REVIEWING → OFFERED` (was
  `INSPECTING → OFFERED`).
- Acquisition creation now requires the request to be `INSPECTING` and
  auto-advances `INSPECTING → ACQUISITION_PENDING` (was `ACCEPTED →
  ACQUISITION_PENDING`). The acquisition service enforces this server-side and
  rejects `invalid_state` otherwise, so an accepted offer can never be paid out
  before physical verification.

## Consequences

- `SellRequestTransitions` in `@pcx/domain` is the single source of truth.
- The status vocabulary (and the `sell_requests.status` check constraint) is
  unchanged; only the transition edges and the auto-advance triggers moved. No
  destructive migration is required.
- `API_SPECIFICATION_STATE_MACHINES.md` §16, `BUSINESS_PRODUCT_REQUIREMENTS.md`
  §12, and `USER_FLOW_SCREEN_MAP.md` §14 are amended to reflect the new order.
- ADR 0011's transition graph is superseded by this ADR's graph; ADR 0011's
  status-vocabulary reconciliation remains valid.
