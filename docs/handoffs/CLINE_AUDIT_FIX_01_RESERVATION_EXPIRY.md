# Agent Handoff: CLINE_AUDIT_FIX_01 — Server-derived reservation expiry

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: db205be
- Date: 2026-08-17

## Outcome

`POST /api/v1/reservations` no longer accepts a client-supplied `reservedUntil`.
The reservation expiry window is derived server-side as `now + reservationWindowMs`
(default 15 minutes), so a customer can no longer lock a physical item until an
arbitrary far-future date (e.g. year 2999).

## Changed areas

- `apps/api/src/modules/commerce/reservation-service.mjs`: removed `reservedUntil`
  from the allowed create input set; expiry is always computed from `clock()` +
  `reservationWindowMs`.
- `apps/api/test/reservation-service.test.mjs`: added a test asserting server-derived
  expiry (fixed clock + default and custom windows) and that a client-supplied
  `reservedUntil` is rejected with `invalid_input`; wired `reservationWindowMs`
  through the test fixture.

## Acceptance criteria

- [x] Client-supplied `reservedUntil` rejected with `invalid_input`.
- [x] Derived expiry equals clock + configured window.
- [x] Configurable `reservationWindowMs` affects derived expiry.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/reservation-service.test.mjs` | 3/3 pass |
| `npm test` | 326 pass, 22 skip, 0 fail |

## Architecture/security review

Invariant "an item cannot be sold twice" remains intact: the one-active-reservation
constraint and bounded expiry window still guard against double-sell; this fix only
removes client control over the window length. No ADR needed — security bugfix
aligned with existing invariant.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Continue `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`:
- Item #2: TOCTOU race in sandbox payment/courier idempotency cache (next, dependency-ready).

## Blockers requiring human decision

None for item #1. (Item #8 dispatcher wiring will need a human decision when reached.)
