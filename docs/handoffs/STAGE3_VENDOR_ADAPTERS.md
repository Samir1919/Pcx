# Handoff: Sandbox vendor adapters behind the injected adapter contract

## Task scope

Add deterministic, secret-free sandbox vendor adapters in the domain package that
implement provider-neutral injected contracts for notification dispatch, payment
charging, and courier shipment creation.

## Acceptance criteria (met)

- `createSandboxNotificationDispatcher({ channel, send })` matches the
  `dispatchers[channel].send(notification)` contract used by
  `createNotificationService`. It validates the notification shape, rejects
  secret-bearing payloads, and delegates delivery to an injected `send`.
- `createSandboxPaymentGateway({ charge })` provides an idempotent
  `charge({ amount, currency, reference })` returning
  `{ providerTransactionId, status }`; charging the same reference twice returns
  the same transaction id.
- `createSandboxCourier({ createShipment })` provides
  `createShipment({ reference, address })` returning `{ trackingId, status }`.
- All adapters validate inputs, never touch real credentials, and are exported
  from `packages/domain/src/index.mjs`.

## Changed files

- `packages/domain/src/vendor/vendor-adapters.mjs` (new)
- `packages/domain/src/index.mjs` (exported the three factories)
- `packages/domain/test/vendor-adapters.test.mjs` (new, 6 tests)
- `docs/tasks/STAGE3_VENDOR_ADAPTERS.md`
- `docs/handoffs/STAGE3_VENDOR_ADAPTERS.md`
- `docs/status/PROJECT_STATUS.md`

## Tests / results

- `node --test packages/domain/test/vendor-adapters.test.mjs`: 6 pass, 0 fail.
- `npm run verify`: pass — E0, lint, typecheck, 247 tests (225 pass, 22
  PostgreSQL skips by design), build, secret scan, dependency audit.

## Decisions / ADRs

- No new ADR. The adapters are additive and do not change business truth or
  source-of-truth. They implement the existing injected notification dispatcher
  contract and introduce provider-neutral gateway/courier interfaces ready for
  later wiring.

## Risks / blockers

- The payment and logistics services have no gateway abstraction yet; wiring the
  sandbox payment/courier adapters into those services is a later slice and was
  intentionally left out of scope to preserve modular-monolith boundaries.
- Real provider credentials and network calls remain human-approval hard stops.

## Branch / commit

- Branch: `agent/stage3-control-plane-foundation`
- Commit: `STAGE3_VENDOR_ADAPTERS` (see `git log -1` for the hash)
