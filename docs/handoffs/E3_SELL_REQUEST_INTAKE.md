# Agent Handoff: E3 Sell-to-PCX Request Intake Foundation

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

An authenticated seller can create a sell-to-PCX request as a server-owned DRAFT (with a confirmed ownership declaration) and submit it. Reads and writes are owner-scoped; the DRAFT → SUBMITTED transition is enforced server-side with invalid transitions returning 409.

## Changed areas

- `packages/domain/src/acquisition/sell-request.mjs`: domain records, status/filfilment constants, DRAFT→SUBMITTED transition, declaration.
- `packages/domain/src/index.mjs`: exports acquisition contracts.
- `apps/api/migrations/0007_sell_requests.sql`: additive `sell_requests` + `seller_declarations` with state/ownership constraints.
- `apps/api/src/modules/acquisition/postgres-sell-request-repository.mjs`, `sell-request-service.mjs`, `sell-request-http.mjs`: persistence, application service, HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `apps/api/src/server.mjs`: runtime wiring and routing.
- Tests: `packages/domain/test/sell-request.test.mjs`, `apps/api/test/sell-request-service.test.mjs`, `apps/api/test/sell-request-http.test.mjs`, `apps/api/test/integration/sell-request-repository.test.mjs`; updated migrations test.

## Acceptance criteria

- [x] Create returns a server-owned DRAFT with normalized contact and owner.
- [x] Unknown fields, invalid preference, and client-supplied status are rejected.
- [x] Ownership declaration requires confirmation.
- [x] List/get/submit are owner-scoped.
- [x] DRAFT-only submit; illegal transition returns 409.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 106 application/unit, 0 failures |
| `npm run test:integration` | Pass: 10/10 (including new sell-request repository) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 106 unit + 10 integration + 1 smoke |

## Architecture/security review

Owner derived from authenticated identity; object-level ownership enforced on every read/write. Exact-origin + double-submit CSRF on writes. Client never supplies status; DRAFT is server-owned. No offer/price data is accepted or exposed.

## Schema/configuration/deployment

Additive migration `0007_sell_requests.sql` (no destructive change).

## Remaining work and next safe action

1. E3 admin queue/detail and info-request/inspection/valuation/offer flows.
2. E8 search/discovery storefront integration.
3. E1 admin user/role screens.

## Blockers requiring human decision

None.
