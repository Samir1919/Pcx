# Task: CLINE_AUDIT_FIX_01 — Server-derived reservation expiry

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Security-sensitive (medium)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None (bug fix aligned with existing invariant "an item cannot be sold twice")

## Objective

Prevent a client from locking a reservation until an arbitrarily far-future date.
`reservedUntil` must never be accepted from client input; derive it server-side as
`now + reservationWindowMs` (default 15 minutes).

## Source-of-truth references

- `AGENTS.md` (mandatory invariants: "An item cannot be sold twice")
- `docs/brain/domain-rules.md`
- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #1

## Scope

- Remove `reservedUntil` from the accepted create input fields in
  `apps/api/src/modules/commerce/reservation-service.mjs`.
- Always derive expiry as `new Date(clock() + reservationWindowMs)`.
- Update `apps/api/test/reservation-service.test.mjs` to assert server-derived
  expiry and reject client-supplied `reservedUntil`.

## Non-scope

- Reservation conversion/expiry domain rules in `packages/domain/src/commerce/reservation.mjs`
  remain unchanged (they are already correct for a server-supplied timestamp).

## Domain invariants affected

- "An item cannot be sold twice": still guarded by one-active-reservation and the
  bounded expiry window; this fix only prevents indefinite locking.

## Acceptance criteria

- [x] `reservedUntil` in client create input is rejected with `invalid_input`.
- [x] Created reservation expiry equals fixed-clock + configured window.
- [x] Configurable `reservationWindowMs` affects derived expiry.

## State/API/schema/UI impact

- API: `POST /api/v1/reservations` no longer accepts a `reservedUntil` body field.
- Schema: none.

## Security and privacy review

- Prevents resource-exhaustion/DoS via indefinite reservation locking.
- No sensitive data exposure; input-derived authority removed.

## Test plan

- Unit: `apps/api/test/reservation-service.test.mjs` (updated).
- Full gate: `npm test` (per audit instruction; not full `npm run verify`).

## Migration and rollback

None.

## Prohibited changes / hard stops

- Do not change payment credentials/production.
- Do not weaken security tests.
