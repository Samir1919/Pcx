# Task: Courier webhook receiver for shipment status updates

## Context

The shipment service now derives the tracking id from the injected sandbox
courier (server-authoritative). The next dependency-ready slice is to accept
inbound courier status updates via a signed webhook so the shipment lifecycle
can advance (e.g., DELIVERED, RETURNED) without an admin manually calling the
deliver endpoint.

## Scope

- Add a `markReturned` transition to the shipment domain (DRAFT/SHIPPED →
  RETURNED) alongside the existing `markDelivered`.
- Add a `markReturned` method to the PostgreSQL shipment repository.
- Add a `handleWebhook` method to the shipment service that:
  - validates the webhook secret (timing-safe, server-side);
  - maps a provider status to a shipment transition (DELIVERED → markDelivered,
    RETURNED → markReturned);
  - records a shipment event with the provider status;
  - is idempotent (a repeated webhook for an already-final state is a no-op,
    not an error).
- Add a webhook HTTP receiver (`POST /api/v1/webhooks/courier`) that parses the
  signed payload and delegates to the service.
- Wire the webhook receiver into the server request handler.

## Out of scope

- Real courier provider credentials/network calls (hard stop).
- Packaging evidence media and return-to-origin logistics.
- Webhook retry/outbox delivery guarantees (later slice).

## Acceptance criteria

- `markReturned` enforces a valid source state and records `returnedAt`.
- `handleWebhook` rejects a bad/missing secret with a stable error.
- `handleWebhook` maps DELIVERED and RETURNED provider statuses to the correct
  transitions and records events.
- `handleWebhook` is idempotent for repeated/final states.
- The webhook HTTP route returns 200 for accepted updates and 401/403 for a bad
  secret, and rejects unknown methods.
- `npm run verify` passes.

## Files

- `packages/domain/src/logistics/shipment.mjs`
- `packages/domain/test/shipment.test.mjs`
- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`
- `apps/api/src/modules/logistics/shipment-service.mjs`
- `apps/api/src/modules/logistics/shipment-webhook-http.mjs` (new)
- `apps/api/src/server.mjs`
- `apps/api/test/shipment-service.test.mjs`
- `apps/api/test/shipment-webhook-http.test.mjs` (new)
- `docs/tasks/STAGE3_COURIER_WEBHOOK.md`
- `docs/handoffs/STAGE3_COURIER_WEBHOOK.md`
- `docs/status/PROJECT_STATUS.md`
