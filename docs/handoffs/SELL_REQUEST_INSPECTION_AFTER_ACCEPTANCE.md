# Agent Handoff: Sell-Request Inspection After Offer Acceptance

- Status: Complete
- Branch: main
- Date: 2026-09-03

## Outcome

The sell-request lifecycle is reordered so that physical inspection happens after
the seller accepts the offer, instead of before it:

```
DRAFT → SUBMITTED → REVIEWING → OFFERED → ACCEPTED
      → INSPECTION_REQUIRED → INSPECTING → ACQUISITION_PENDING → PAID → CLOSED
```

The admin now makes an offer during review, the seller accepts it, and only then
is the item inspected before acquisition/payment. Acquisition creation is
server-enforced to require `INSPECTING`, so an accepted offer can never be paid
out before the item has actually been verified. See ADR 0016 (supersedes ADR 0011's
transition graph).

## Changed areas

- `packages/domain/src/acquisition/sell-request.mjs` — `SellRequestTransitions`
  reordered (REVIEWING → OFFERED; ACCEPTED → INSPECTION_REQUIRED; INSPECTING →
  ACQUISITION_PENDING | REJECTED).
- `apps/api/src/modules/acquisition/postgres-acquisition-repository.mjs` —
  `createOffer` auto-advances REVIEWING → OFFERED (was INSPECTING → OFFERED);
  `createAcquisition` auto-advances INSPECTING → ACQUISITION_PENDING (was ACCEPTED
  → ACQUISITION_PENDING); added `findSellRequestStatus`.
- `apps/api/src/modules/acquisition/acquisition-service.mjs` — `createAcquisition`
  now rejects `invalid_state` unless the sell request is `INSPECTING` (server-side
  guard).
- `apps/admin/app/(workspace)/acquisition/sell-request-modal.js` — transition
  buttons reordered; "Create acquisition" only shown when status is INSPECTING.
- `apps/admin/lib/sell-request-status.js` — `SELL_REQUEST_FLOW` stepper reordered.
- `scripts/acquisition-flow-e2e-check.mjs` — click-through reordered (offer →
  accept → inspection → acquisition → pay) with explicit inspection status checks.
- Specs amended: `API_SPECIFICATION_STATE_MACHINES.md` §16, `BUSINESS_PRODUCT_REQUIREMENTS.md`
  §12, `USER_FLOW_SCREEN_MAP.md` §14.
- ADR 0016 added; ADR 0011 marked as superseded for the transition graph only.

## Acceptance criteria

- [x] Domain transition graph reordered (inspection after acceptance) — covered by `packages/domain/test/sell-request.test.mjs`.
- [x] Acquisition creation server-enforced to INSPECTING — covered by `apps/api/test/acquisition-service.test.mjs` ("acquisition rejects when the sell request is not INSPECTING").
- [x] Admin UI stepper + transitions + "Create acquisition" gating reordered — covered by `apps/admin/test/sell-request-status.test.mjs` + headed e2e.
- [x] Repository auto-advance triggers updated — covered by `apps/api/test/integration/acquisition-repository.test.mjs` (DB-gated, skipped in local run).
- [x] Headed browser evidence committed (`docs/verify/browser-verify.json`, 18/18 steps).

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (verify:e0, lint, typecheck, 680 tests / 0 fail, build, security, ui-guard) |
| `node scripts/acquisition-flow-e2e-check.mjs` (headless) | 16/16 pass |
| `PCX_HEADED=1 node scripts/acquisition-flow-e2e-check.mjs --evidence` (headed) | 18/18 pass |

## Architecture/security review

- Business-truth change (state machine order) recorded as ADR 0016; specs updated
  so implementation and source-of-truth do not conflict. No destructive migration
  (status vocabulary and the `sell_requests.status` check constraint are unchanged).
- Server-owned invariant preserved: acquisition only opens from INSPECTING, so a
  "final" offer accepted on a seller's self-description is never paid out before
  physical verification. Prices/status remain server-authoritative.

## Schema/configuration/deployment

- None. No migration; no new environment variables.

## Remaining work and next safe action

- Seller-facing storefront surface for the post-acceptance steps (S14/S15) — the
  seller currently sees only a collapsed "Completed" label; exposing the
  server-owned acquisition/payment status read-only to the owner is the next
  storefront slice (separate from this reorder).

## Blockers requiring human decision

- None.
