# Agent Handoff: Real bKash HTTP adapter (E10, sandbox-only)

- Status: Complete
- Branch: main
- Latest commit: 96853a6
- Date: 2026-09-01

## Outcome

The payment service now talks to the real bKash sandbox API. When active SANDBOX
bKash credentials are configured (admin → Payment providers), `createPayment`
routes through a real HTTP gateway: grant token → create payment (URL-based
checkout, mode "0011"), returning the bKash `paymentID` as the server-authoritative
provider transaction id (INITIATED) plus the redirect `bkashURL`. LIVE mode fails
closed (never constructs a live gateway). A refund HTTP operation is implemented
and ready for the returns module to adopt.

## Changed areas

- `apps/api/src/modules/payment/bkash-http-adapter.mjs` (new) — real HTTP adapter
  (grant token / create / execute / query / refund) with researched endpoints,
  `username`/`password` + `Authorization`/`X-App-Key` headers, token caching,
  timeout, and a sandbox-host guard (live host rejected).
- `apps/api/src/modules/payment/bkash-http-gateway.mjs` (new) — maps the adapter
  to the provider-neutral `charge`/`execute`/`query`/`refund` contract.
- `apps/api/src/modules/commerce/order-payment-service.mjs` — `resolveGateway`
  builds the HTTP gateway for active SANDBOX credentials and throws for REAL;
  injectable `bkashGatewayFactory` for tests.
- `apps/admin/app/(workspace)/payments/workspace.js` — read-only sandbox endpoint
  note ("place in admin").
- Tests: `bkash-http-adapter.test.mjs`, `bkash-http-gateway.test.mjs`,
  `order-payment-service.test.mjs` (updated).

## Acceptance criteria

- [x] Real bKash HTTP adapter behind the injected gateway contract.
- [x] Sandbox-only: LIVE mode fails closed (hard stop honored).
- [x] Server-authoritative provider transaction id (bKash paymentID).
- [x] Refund HTTP operation implemented (adapter + gateway) for the returns module.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/bkash-http-adapter.test.mjs` | 6/6 pass |
| `node --test apps/api/test/bkash-http-gateway.test.mjs` | 4/4 pass |
| `node --test apps/api/test/order-payment-service.test.mjs` | 10/10 pass |
| `npm test` (unit) | 0 fail |
| `npm run lint` / `typecheck` | pass |

Note: `npm run build` fails locally (`/_global-error` prerender) because local
Node is v26.4.0 vs supported `>=24 <25` — pre-existing. Two integration tests
(`sell-request-repository`, `sell-taxonomy-repository`) fail against the shared
local `pcx` DB from prior-run pollution — pre-existing.

## Architecture/security review

- Follows ADR 0006 (server-authoritative provider transaction id).
- Credentials are decrypted only at the composition root (`getActiveCredentials`)
  and passed to the adapter in-memory; never logged or exposed.
- The adapter rejects any non-sandbox host, so live credentials can never be used
  without explicit approval (hard stop).

## Schema/configuration/deployment

- None (no migration). Sandbox base URL is a constant; live base URL is rejected.

## Remaining work and next safe action

- Wire the bKash refund into the returns module `settleRefund` (paymentProviderConfig
  resolver), the redirect/callback endpoint + `execute`/`query` reconciliation, and
  bKash IPN webhook handling.
- Then: E5 inspection follow-ups, E7/E8 passport & storefront.

## Blockers requiring human decision

- Real bKash LIVE credentials and live mode require explicit human approval (hard
  stop). Production deployment also remains a hard stop.
