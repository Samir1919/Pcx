# Agent Handoff: CLINE_AUDIT_FIX_03 — Payment idempotency key & gateway reuse

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: 4e999ab
- Date: 2026-08-17

## Outcome

`createPayment` now derives a deterministic charge reference from order + amount
and reuses resolved gateway instances via a cache keyed by activation identity,
so a client retry after a timeout reuses the same idempotency key instead of
starting a fresh charge under a fresh `randomUUID()` reference.

## Changed areas

- `apps/api/src/modules/commerce/order-payment-service.mjs`: added `chargeReference`
  (`payment-<orderId>-<amount>`) and a `gatewayCache` keyed on `provider:mode:credentials`.
- `apps/api/test/order-payment-service.test.mjs`: updated reference assertions and
  added a determinism test proving retries reuse the same reference.

## Acceptance criteria

- [x] A retry for the same order+amount reuses the same charge reference.
- [x] Resolved gateway instances are reused (not rebuilt per call).

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/order-payment-service.test.mjs` | 7/7 pass |
| `npm test` | 329 pass, 22 skip, 0 fail |

## Architecture/security review

Invariant "payment operations are idempotent" strengthened. Reference is
server-derived (never client-supplied); gateway cache key includes full
credentials so credential rotation does not reuse a stale gateway.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Continue `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`:
- Item #4: broken webhook retry in `postgres-shipment-repository.mjs` `markWebhookFailed`.

## Blockers requiring human decision

None for item #3. (Item #8 dispatcher wiring will need a human decision when reached.)
