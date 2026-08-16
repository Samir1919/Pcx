# Handoff: Wire sandbox payment gateway into the order-payment service

## Task scope

Make the provider transaction id server-authoritative in the order-payment
service by deriving it from the injected sandbox payment gateway instead of
trusting client input.

## Acceptance criteria (met)

- `createOrderPaymentService` accepts an optional injected `gateway` that
  defaults to the sandbox gateway (`createSandboxPaymentGateway`).
- `createPayment` calls `gateway.charge({ amount, currency, reference })` to
  derive the `providerTransactionId` server-side; the reference is the
  server-generated payment id.
- `providerTransactionId` is removed from the client allow-list; a client that
  supplies it receives `invalid_input`.
- `provider` defaults to `"SANDBOX"` when not supplied.
- The confirm flow is unchanged (confirming by an existing provider transaction
  id remains valid).
- Tests cover the gateway-derived flow, rejection of a client-forged
  `providerTransactionId`, and an injected custom gateway with the `SANDBOX`
  provider default.
- ADR 0006 records the server-authoritative decision.

## Changed files

- `apps/api/src/modules/commerce/order-payment-service.mjs`
- `apps/api/test/order-payment-service.test.mjs`
- `docs/adr/0006-server-authoritative-payment-gateway.md` (new)
- `docs/tasks/STAGE3_PAYMENT_GATEWAY_WIRING.md`
- `docs/handoffs/STAGE3_PAYMENT_GATEWAY_WIRING.md`
- `docs/status/PROJECT_STATUS.md`

## Tests / results

- `node --test apps/api/test/order-payment-service.test.mjs`: 4 pass, 0 fail.
- `npm run verify`: pass — E0, lint, typecheck, 249 tests (227 pass, 22
  PostgreSQL skips by design), build, secret scan, dependency audit.

## Decisions / ADRs

- ADR 0006 (Accepted): the provider transaction id is a server-owned financial
  fact derived from the injected gateway, never accepted from client input. This
  closes the client-forgery path for confirming a payment that was never charged.

## Risks / blockers

- Payment creation now depends on a gateway call; a gateway failure maps to
  `invalid_input` until a retry/outbox strategy is added (later slice).
- The courier adapter is not yet wired into the logistics service (separate
  slice).
- Real provider credentials and network calls remain human-approval hard stops.

## Branch / commit

- Branch: `agent/stage3-control-plane-foundation`
- Commit: `STAGE3_PAYMENT_GATEWAY_WIRING` (see `git log -1` for the hash)
