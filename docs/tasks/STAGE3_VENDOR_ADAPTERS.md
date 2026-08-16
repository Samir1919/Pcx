# Task: Sandbox vendor adapters behind the injected adapter contract

## Scope

Add deterministic, secret-free sandbox vendor adapters in the domain package that
implement provider-neutral injected contracts, so the platform can integrate with
real providers later without changing service internals.

## Acceptance criteria

- `createSandboxNotificationDispatcher({ channel, send })` returns an object
  matching the `dispatchers[channel].send(notification)` contract used by
  `createNotificationService`. It validates the notification shape, rejects
  secret-bearing payloads, and delegates delivery to an injected `send`.
- `createSandboxPaymentGateway({ charge })` returns a provider-neutral gateway
  with an idempotent `charge({ amount, currency, reference })` method that
  returns `{ providerTransactionId, status }`. Charging the same reference twice
  returns the same transaction id.
- `createSandboxCourier({ createShipment })` returns a provider-neutral courier
  with `createShipment({ reference, address })` returning
  `{ trackingId, status }`.
- All adapters validate inputs, never touch real credentials, and are exported
  from `packages/domain/src/index.mjs`.
- Deterministic tests cover the notification dispatcher contract, payment
  idempotency, courier shipment creation, and input/secret validation.

## Out of scope

- Wiring the payment/courier adapters into the commerce/logistics services
  (those services have no gateway abstraction yet; wiring is a later slice).
- Real provider credentials or network calls (hard stop).

## Files

- `packages/domain/src/vendor/vendor-adapters.mjs` (new)
- `packages/domain/src/index.mjs` (export)
- `packages/domain/test/vendor-adapters.test.mjs` (new)
- `docs/tasks/STAGE3_VENDOR_ADAPTERS.md` (this file)
- `docs/handoffs/STAGE3_VENDOR_ADAPTERS.md`
- `docs/status/PROJECT_STATUS.md`

## Verification

- `node --test packages/domain/test/vendor-adapters.test.mjs`
- `npm run verify` (E0, lint, typecheck, tests, build, security)
