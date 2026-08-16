# Task: Wire sandbox payment gateway into the order-payment service

## Scope

Make the provider transaction id server-authoritative in the order-payment
service by deriving it from the injected sandbox payment gateway instead of
trusting client input. This closes the client-forgery path for a financial fact
and makes the payment flow provider-neutral.

## Acceptance criteria

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

## Out of scope

- Wiring the courier adapter into the logistics service (separate slice).
- Real provider credentials or network calls (hard stop).
- A retry/outbox strategy for gateway failures (later slice).

## Files

- `apps/api/src/modules/commerce/order-payment-service.mjs`
- `apps/api/test/order-payment-service.test.mjs`
- `docs/adr/0006-server-authoritative-payment-gateway.md` (new)
- `docs/tasks/STAGE3_PAYMENT_GATEWAY_WIRING.md` (this file)
- `docs/handoffs/STAGE3_PAYMENT_GATEWAY_WIRING.md`
- `docs/status/PROJECT_STATUS.md`

## Verification

- `node --test apps/api/test/order-payment-service.test.mjs`
- `npm run verify` (E0, lint, typecheck, tests, build, security)
