# ADR 0006: Server-authoritative gateway-derived provider transaction id

- Status: Accepted
- Date: 2026-08-16

## Context

The order-payment service previously accepted `providerTransactionId` directly
from client input when creating a payment. This conflicts with the mandatory
invariant that "client input never authoritatively sets price, totals, role,
status, grade, or warranty eligibility" and, by extension, financial facts such
as the provider transaction id. A client-forged transaction id could be used to
confirm a payment that was never actually charged, undermining the idempotent
payment invariant.

The platform now has a deterministic, secret-free sandbox payment gateway
(`createSandboxPaymentGateway`) behind a provider-neutral injected contract. The
next step is to make the provider transaction id server-authoritative by
deriving it from the gateway rather than trusting client input.

## Decision

Make the provider transaction id server-authoritative in the order-payment
service:

- `createOrderPaymentService` accepts an optional injected `gateway` that
  defaults to the sandbox gateway.
- `createPayment` calls `gateway.charge({ amount, currency, reference })` to
  derive the `providerTransactionId` server-side. The `reference` is the
  server-generated payment id.
- `providerTransactionId` is removed from the client allow-list; a client that
  supplies it receives `invalid_input`.
- `provider` defaults to `"SANDBOX"` when not supplied, and remains a
  client-supplied label otherwise.
- The confirm flow is unchanged: confirming by an existing provider transaction
  id remains valid because the id is now gateway-derived and server-owned.

This preserves the idempotent-payment invariant (unique provider transaction id)
while ensuring the id is never client-forged.

## Alternatives considered

### Keep trusting client-supplied providerTransactionId

Rejected. It violates the server-authoritative financial-fact invariant and
allows a client to confirm a payment that was never charged.

### Require the gateway to be injected with no default

Rejected for the foundation. A default sandbox gateway keeps the service
runnable and testable without external dependencies while still being
overridable with a real provider later.

## Consequences

### Positive

- The provider transaction id is a server-owned financial fact, closing the
  client-forgery path.
- The payment flow is provider-neutral and ready to swap in a real gateway
  without changing service internals.
- Idempotency by unique provider transaction id is preserved.

### Negative

- Payment creation now depends on a gateway call; a gateway failure maps to
  `invalid_input` until a retry/outbox strategy is added.
- The HTTP create-payment contract no longer accepts `providerTransactionId`
  (it was never exposed as a create field in the HTTP boundary, so no public
  contract change).

## Rollout and rollback

Roll out with the sandbox gateway default. To roll back, revert to accepting
client-supplied `providerTransactionId`; no migration is required because the
payment table schema is unchanged.

## Approval

Accepted by the human instruction to proceed with wiring the sandbox payment
gateway into the payment service with gateway-derived, server-authoritative
`providerTransactionId`.
