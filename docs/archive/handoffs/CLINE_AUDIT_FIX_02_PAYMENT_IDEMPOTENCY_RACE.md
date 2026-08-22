# Agent Handoff: CLINE_AUDIT_FIX_02 — TOCTOU race in payment idempotency cache

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: f1441d3
- Date: 2026-08-17

## Outcome

The sandbox and bKash payment gateways now store the in-flight `charge` promise in
the idempotency cache immediately (before awaiting the real charge). Concurrent
callers with the same reference await the same promise instead of each passing the
`seen.has()` check and racing a second real charge. A failed charge is evicted from
the cache so a later retry is not poisoned by a rejected promise.

## Changed areas

- `packages/domain/src/vendor/vendor-adapters.mjs`: reworked the `seen` cache in
  both `createSandboxPaymentGateway` and `createBkashGateway` to cache the in-flight
  promise; delete on rejection.
- `packages/domain/test/vendor-adapters.test.mjs`: added a concurrency test asserting
  two same-reference charges invoke the injected `charge` exactly once.
- `apps/api/test/bkash-gateway.test.mjs`: added the equivalent concurrency test for bKash.

## Acceptance criteria

- [x] Two concurrent same-reference charges invoke the real charge only once.
- [x] Both callers receive the same provider transaction id.

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/vendor-adapters.test.mjs apps/api/test/bkash-gateway.test.mjs` | 12/12 pass |
| `npm test` | 328 pass, 22 skip, 0 fail |

## Architecture/security review

Invariant "payment operations are idempotent" reinforced: same-reference concurrency
now shares a single in-flight charge, removing the double-charge window. No ADR needed.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

Continue `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`:
- Item #3: fresh gateway/idempotency cache per payment call in
  `apps/api/src/modules/commerce/order-payment-service.mjs` (next, dependency-ready).

## Blockers requiring human decision

None for item #2. (Item #8 dispatcher wiring will need a human decision when reached.)
