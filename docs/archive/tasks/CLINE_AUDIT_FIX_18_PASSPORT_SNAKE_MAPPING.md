# Task: CLINE_AUDIT_FIX_18 — Public passport snake→camel mapping

- Status: Complete
- Owner/agent: Cline
- Branch: `agent/admin-ui-responsive-fixes`
- Risk: Medium (public API silently returns 404)
- Related epic: E7 — Listing, pricing & passport
- Related ADRs: None

## Objective

`listingService.publicPassport()` must return a populated public passport object for a
found, PUBLISHED item instead of silently returning `null`.

## Source-of-truth references

- `AGENTS.md` (passport invariant: public passports never expose serials/cost/private evidence)
- `docs/brain/domain-rules.md`
- `docs/tasks/E7_LISTING_PASSPORT.md`

## Scope

- `apps/api/src/modules/listing/listing-service.mjs`: map the raw snake_case row
  returned by `repository.findPublicPassport()` into the camelCase props consumed by
  `createPublicPassport()`, mirroring the existing `searchPublic()` mapping. Convert
  `row.price` from Postgres `numeric` (string) to a number with `Number(row.price)`.
  Log the caught construction error so a real bug can no longer be silently misreported
  as a 404.
- `apps/api/test/listing-service.test.mjs`: change the `findPublicPassport` fixture to
  return the snake_case shape the real repository returns (and `price` as a string), and
  add a regression assertion that `publicPassport()` returns a populated object for a
  published item.

## Non-scope

- No change to `createPublicPassport()` itself.
- No change to repository SQL or the repository method.
- No change to `apps/api/src/modules/listing/listing-http.mjs` external behavior
  (still 404 `PASSPORT_NOT_FOUND` when no row exists).
- No new logging framework; use existing `console.error`, matching current repo convention.

## Domain invariants affected

- Public passports never expose full serials, acquisition cost, or private evidence:
  unaffected — `createPublicPassport()` still projects only approved disclosure fields.
- Submitted inspection history is preserved / state transitions enforced on server:
  unaffected.

## Acceptance criteria

- [x] `publicPassport()` maps snake_case row keys and returns a populated passport
      object (not `null`) for a found, published item.
- [x] Regression test exercises the snake_case row shape and asserts a populated result.
- [x] Existing security test (no `serial`/`acquisitionCost` leak) still passes.

## State/API/schema/UI impact

- Public `GET /api/v1/passport/:pcxId` now returns `200 { data: passport }` for valid
  published items instead of an incorrect `404 PASSPORT_NOT_FOUND`.

## Security and privacy review

Public passport is already a disclosure-only projection. The change only maps column
names and converts a numeric string; it does not broaden the projection to any private
field. The caught construction error is logged without exposing internals to clients.

## Test plan

- Unit: `node --test apps/api/test/listing-service.test.mjs`
- Full gate: `npm run verify:e0`, `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
