# ADR 0012: Remove internal valuation concept

- Status: Accepted
- Date: 2026-08-25

## Context

The acquisition domain had a three-step chain `sell_request → valuation → offer`
before an acquisition could be recorded. Admin staff first created a
`valuations` row (an internal estimate with a low/high/recommended range and a
type), then created an `offers` row that referenced `valuation_id`. This added a
manual UUID-pasting step without adding business value: the final offer amount
is server-owned and the invariant "estimated seller ranges are not final
offers" is already satisfied by the indicative quote range
(`indicative_prices`), which is shown to sellers up front and is a distinct
object from the offer.

The intermediate `valuation` entity was therefore redundant. Its presence also
conflicted with the simpler seller-facing mental model (quote range → offer →
accept → acquisition) already documented in the storefront flows.

## Decision

Remove the internal `valuation` concept entirely:

- Drop the `valuations` table and the `offers.valuation_id` column/foreign-key.
- Create offers directly from a sell request (`sellRequestId` + `amount` +
  `expiresAt`), with `amount` and `status` remaining server-owned.
- Remove `createValuation`/`ValuationType` from the domain contract and the
  `POST /api/v1/admin/valuations` endpoint, repository method, admin API client
  call, and the admin "Create valuation" form.
- Update the source-of-truth specifications (DATABASE_ERD, API specification,
  Business Product Requirements, User Flow Screen Map) to drop the valuation
  entity, endpoint, and flow step.

This is a domain/source-of-truth change and the migration is destructive
(`DROP TABLE` / `DROP COLUMN`), so it required explicit human approval as a
hard stop.

## Approval

Approved by the user on 2026-08-25 after the explicit hard-stop review. This
approval authorizes the removal of the internal valuation concept and its
idempotent destructive migration in development/staging only; it does not
authorize production deployment.

## Consequences

- `packages/domain/src/acquisition/valuation-offer.mjs` no longer exports
  `createValuation` or `ValuationType`; `createOffer` no longer accepts
  `valuationId`.
- Migration `0035_remove_valuation.sql` drops `valuations` and
  `offers.valuation_id` idempotently (guards use `IF EXISTS` and dynamic
  constraint-name resolution).
- Admin acquisition flow shortens to offer → accept → acquisition → paid.
- The "estimated ranges are not final offers" invariant is preserved by the
  indicative quote range (`indicative_prices`), which remains a separate,
  server-owned object from the final offer.
