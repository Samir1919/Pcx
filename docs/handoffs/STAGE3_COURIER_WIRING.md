# Handoff: Wire sandbox courier adapter into the shipment service

## Task scope

Make the tracking id server-authoritative in the shipment service by deriving it
from the injected sandbox courier instead of trusting client input.

## Acceptance criteria (met)

- `createShipmentService` accepts an optional injected `courier` that defaults to
  the sandbox courier (`createSandboxCourier`).
- `ship` calls `courier.createShipment({ reference, address })` to derive the
  `trackingId` server-side; the reference is the server-owned shipment id.
- `trackingId` is removed from the client allow-list; the HTTP ship endpoint only
  reads `body.address` and never accepts a client-supplied tracking id.
- The shipment event records the courier-provided status as `providerStatusRaw`.
- The deliver flow is unchanged.
- Tests cover the courier-derived flow, rejection/ignoring of a client-forged
  `trackingId`, an injected custom courier, and courier-failure mapping.

## Changed files

- `apps/api/src/modules/logistics/shipment-service.mjs`
- `apps/api/src/modules/logistics/shipment-http.mjs`
- `apps/api/test/shipment-service.test.mjs`
- `apps/api/test/shipment-http.test.mjs`
- `docs/tasks/STAGE3_COURIER_WIRING.md` (new)
- `docs/handoffs/STAGE3_COURIER_WIRING.md` (new)
- `docs/status/PROJECT_STATUS.md`

## Tests / results

- `node --test apps/api/test/shipment-service.test.mjs apps/api/test/shipment-http.test.mjs`: 9 pass, 0 fail.
- `npm run verify`: pass — E0, lint, typecheck, 253 tests (231 pass, 22
  PostgreSQL skips by design), build, secret scan, dependency audit.

## Decisions / ADRs

- No new ADR. The change is additive and does not change business truth or
  source-of-truth. It follows the same server-authoritative pattern as ADR 0006
  (payment gateway): the tracking id is a server-owned logistics fact derived
  from the injected courier, never accepted from client input.

## Risks / blockers

- Shipment creation now depends on a courier call; a courier failure maps to
  `invalid_input` until a retry/outbox strategy is added (later slice).
- Real courier provider credentials and network calls remain human-approval hard
  stops.
- Packaging evidence media and return-to-origin remain separate slices.

## Branch / commit

- Branch: `agent/stage3-control-plane-foundation`
- Commit: `STAGE3_COURIER_WIRING` (see `git log -1` for the hash)
