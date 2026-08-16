# Agent Handoff: Courier webhook receiver for shipment status updates

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: (pending commit for this slice)
- Date: 2026-08-16

## Outcome

The shipment lifecycle can now advance from inbound courier status updates via a
signed webhook (`POST /api/v1/webhooks/courier`). A provider status of
`DELIVERED` or `RETURNED` maps to the corresponding shipment transition and
records a shipment event with the raw provider status. The webhook is
server-authoritative: the signature is validated with a timing-safe comparison,
and repeated webhooks for an already-final state are idempotent no-ops rather
than errors. Informational provider statuses (e.g. `IN_TRANSIT`) are recorded as
events without a state change.

## Changed areas

- `packages/domain/src/logistics/shipment.mjs` — added `markReturned` transition
  (SHIPPED → RETURNED) and `ShipmentStatus.RETURNED`.
- `packages/domain/src/index.mjs` — exported `markReturned`.
- `packages/domain/test/shipment.test.mjs` — tests for `markReturned`.
- `apps/api/migrations/0019_shipments_returned_at.sql` — added `returned_at`
  column to `shipments`.
- `apps/api/test/integration/migrations.test.mjs` — updated expected migration
  list to include `0019`.
- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs` — added
  `markReturned` (SHIPPED → RETURNED) and `recordEvent` for shipment events.
- `apps/api/src/modules/logistics/shipment-service.mjs` — added `handleWebhook`
  with timing-safe secret validation, provider-status→transition mapping, event
  recording, and idempotency; added `webhookSecret` option.
- `apps/api/src/modules/logistics/shipment-webhook-http.mjs` (new) — webhook HTTP
  receiver for `POST /api/v1/webhooks/courier`.
- `apps/api/src/server.mjs` — wired the webhook receiver into the request
  handler.
- `apps/api/src/modules/identity/auth-runtime.mjs` — wired `courierWebhookSecret`
  (from `COURIER_WEBHOOK_SECRET`) into the shipment service.
- `apps/api/test/shipment-service.test.mjs` — added `handleWebhook` tests.
- `apps/api/test/shipment-webhook-http.test.mjs` (new) — webhook HTTP tests.

## Acceptance criteria

- [x] `markReturned` enforces a valid source state and records `returnedAt`.
- [x] `handleWebhook` rejects a bad/missing secret with a stable error
      (`unauthorized`).
- [x] `handleWebhook` maps DELIVERED and RETURNED provider statuses to the
      correct transitions and records events.
- [x] `handleWebhook` is idempotent for repeated/final states.
- [x] The webhook HTTP route returns 200 for accepted updates and 401 for a bad
      secret, and rejects unknown methods.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/shipment-service.test.mjs apps/api/test/shipment-webhook-http.test.mjs apps/api/test/shipment-http.test.mjs` | 19 pass, 0 fail |
| `npm test` | 264 tests, 242 pass, 22 skipped, 0 fail |
| `npm run verify:e0` | Pass (36 required artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run security` | Pass |

## Architecture/security review

- The webhook secret is validated server-side with a timing-safe comparison
  (`timingSafeEqual` over SHA-256 digests). The default is `null`, which makes
  the webhook fail-closed (rejects all requests) until `COURIER_WEBHOOK_SECRET`
  is configured. This preserves the invariant that state transitions and
  authorization are enforced on the server.
- The webhook does not require CSRF/origin checks because it is a
  server-to-server integration authenticated by the shared secret, not a
  browser session. It is wired before the admin shipment handler and does not
  accept query parameters.
- Provider statuses are mapped to transitions only for terminal states
  (DELIVERED, RETURNED); all other statuses are recorded as informational
  events without advancing the lifecycle. This keeps the server authoritative
  over shipment state.
- No ADR change required; this extends the existing logistics module within the
  modular-monolith boundary.

## Schema/configuration/deployment

- New migration `0019_shipments_returned_at.sql` adds `returned_at` to
  `shipments`. It is additive and reversible (drop column).
- New environment variable `COURIER_WEBHOOK_SECRET` configures the webhook
  signature. When unset, the webhook rejects all requests (fail-closed).

## Remaining work and next safe action

1. Webhook retry/outbox delivery guarantees (explicitly out of scope for this
   slice).
2. Real courier provider credentials/network calls (hard stop — requires human
   approval).
3. Packaging evidence media and return-to-origin logistics.

## Blockers requiring human decision

None.
