# Task: Wire sandbox courier adapter into the shipment service

## Scope

Make the tracking id server-authoritative in the shipment service by deriving it
from the injected sandbox courier instead of trusting client input. This closes
the client-forgery path for a logistics fact and makes the shipment flow
provider-neutral.

## Acceptance criteria

- `createShipmentService` accepts an optional injected `courier` that defaults to
  the sandbox courier (`createSandboxCourier`).
- `ship` calls `courier.createShipment({ reference, address })` to derive the
  `trackingId` server-side; the reference is the server-owned shipment id.
- `trackingId` is removed from the client allow-list; a client that supplies it
  receives `invalid_input`.
- The shipment event records the courier-provided status as `providerStatusRaw`.
- The deliver flow is unchanged.
- Tests cover the courier-derived flow, rejection of a client-forged
  `trackingId`, and an injected custom courier.
- `npm run verify` passes.

## Out of scope

- Real courier provider credentials or network calls (hard stop).
- A retry/outbox strategy for courier failures (later slice).
- Packaging evidence media or return-to-origin (separate slices).

## Files

- `apps/api/src/modules/logistics/shipment-service.mjs`
- `apps/api/src/modules/logistics/shipment-http.mjs`
- `apps/api/test/shipment-service.test.mjs`
- `apps/api/test/shipment-http.test.mjs`
- `docs/tasks/STAGE3_COURIER_WIRING.md` (this file)
- `docs/handoffs/STAGE3_COURIER_WIRING.md`
- `docs/status/PROJECT_STATUS.md`

## Verification

- `node --test apps/api/test/shipment-service.test.mjs apps/api/test/shipment-http.test.mjs`
- `npm run verify` (E0, lint, typecheck, tests, build, security)
