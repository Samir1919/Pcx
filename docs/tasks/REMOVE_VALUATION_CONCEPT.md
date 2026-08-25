# Task: Remove internal valuation concept

- Status: Complete
- Owner/agent: cline
- Branch: `agent/remove-valuation`
- Risk: Medium (destructive migration + source-of-truth change)
- Related epic: E3 — Sell-to-PCX (acquisition flow simplification)
- Related ADRs: 0012

## Objective

Remove the redundant internal `valuation` entity so an offer is created
directly from a sell request (`sellRequestId` + `amount` + `expiresAt`),
eliminating the manual `sell_request → valuation → offer` step.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`
- `docs/specifications/USER_FLOW_SCREEN_MAP.md`
- `docs/adr/0012-remove-valuation-concept.md`

## Scope

- Domain: remove `createValuation`/`ValuationType`; `createOffer` drops
  `valuationId`.
- API: remove `createValuation` service/repository method and the
  `POST /api/v1/admin/valuations` route.
- Admin UI: remove "Create valuation" form; "Create offer" drops the
  `valuationId` field.
- Migration: idempotent `0035_remove_valuation.sql` drops `valuations` and
  `offers.valuation_id`.
- Seed script: seed offers directly without a valuation row.
- Specs: remove valuation entity/endpoint/flow references.

## Non-scope

- Trade-in valuations (`trade_valuations`) — separate concept, unchanged.
- Indicative quote ranges (`indicative_prices`) — unchanged; still the
  seller-facing estimated range.

## Domain invariants affected

- "Estimated seller ranges are not final offers" — preserved: the indicative
  quote range remains a distinct, server-owned object; offer `amount`/`status`
  stay server-owned.
- "An item cannot be sold twice" / "client never authoritatively sets price" —
  unaffected; offer and acquisition contracts still freeze `amount` and
  `agreedPrice` server-side.

## Acceptance criteria

- [x] `createValuation`, `ValuationType`, `valuation_id` absent from domain,
      API, admin UI, and seed code.
- [x] Migration `0035` drops `valuations` and `offers.valuation_id`
      idempotently; integration test asserts both are gone.
- [x] Specs no longer reference the valuation entity/endpoint/flow step.
- [x] `npm run verify` passes (with headed browser evidence for the changed
      admin acquisition surface).

## State/API/schema/UI impact

- API: `POST /api/v1/admin/valuations` removed.
- Schema: `valuations` dropped; `offers.valuation_id` dropped.
- UI: admin `/acquisition` detail modal loses the "Create valuation" form.

## Security and privacy review

- No new endpoints or data exposure. Removal only; server-owned price/status
  invariants unchanged. Write endpoints remain CSRF + RBAC gated.

## Test plan

- Unit: domain valuation-offer tests; acquisition service/http/repository
  tests; admin acquisition-api test.
- Integration: migrations test asserts `valuations`/`valuation_id` dropped;
  acquisition repository integration test.
- E2E: `scripts/admin-e2e-check.mjs` asserts the detail modal renders with
  offer/acquisition forms (no valuation form).
- Full gate: `npm run verify`.

## Migration and rollback

- Migration `0035_remove_valuation.sql` is destructive (DROP TABLE/COLUMN) and
  idempotent. Rollback is restore-from-backup before this migration; no
  forward-only data is produced. Destructive migration was a hard stop,
  approved by the user.

## Prohibited changes / hard stops

- No production deployment.
- No change to trade-in valuation or indicative quote range behavior.
