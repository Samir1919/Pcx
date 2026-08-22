# Agent Handoff: CLINE_AUDIT_FIX_18 — Public passport snake→camel mapping

- Status: Complete
- Branch: `agent/admin-ui-responsive-fixes`
- Latest commit: `75823ba`
- Date: 2026-08-18

## Outcome

`listingService.publicPassport()` now explicitly maps the snake_case row returned by
`repository.findPublicPassport()` into the camelCase props consumed by
`createPublicPassport()`. A found, PUBLISHED item now returns a populated public passport
object instead of silently returning `null` (which the HTTP layer surfaced as a false
`404 PASSPORT_NOT_FOUND`).

## Changed areas

- `apps/api/src/modules/listing/listing-service.mjs`: `publicPassport()` now maps
  `pcx_item_id → pcxItemId`, `model_id → modelId`, `category_id → categoryId`,
  `brand_id → brandId`, `price` (Postgres `numeric` string) via `Number(row.price)`,
  `status`, and `published_at → publishedAt`, mirroring the existing `searchPublic()`
  pattern. The bare `catch {}` now logs the caught construction error before returning
  `null`, so a real bug is no longer invisible as a 404.
- `apps/api/test/listing-service.test.mjs`: the `findPublicPassport` fixture now returns
  the snake_case shape the real repository returns (with `price` as a string), and the
  regression test asserts a populated passport (pcxItemId/modelId/categoryId/brandId/
  status/price) plus that `serial` is not leaked.

## Acceptance criteria

- [x] `publicPassport()` maps snake_case row keys and returns a populated passport object
      (not `null`) for a found, published item — verified by unit test.
- [x] Regression test exercises the snake_case row shape and asserts a populated result.
- [x] Existing security test (no `serial`/`acquisitionCost` leak) still passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/listing-service.test.mjs` | 4/4 pass |
| `npm test` | 369 pass, 0 fail, 22 skipped (DB integration) |
| `npm run verify:e0` | 36 required artifacts verified |
| `npm run verify` | Pass (E0, lint, typecheck, tests, build, security) |

## Architecture/security review

Public passport remains a disclosure-only projection; no new private field is exposed.
The change only maps column names and converts a numeric string. The caught construction
error is logged via `console.error` without exposing internals to clients. No invariant
or source-of-truth change; no ADR required.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

1. (Optional hardening) Replace the `console.error` ad-hoc log with the repository's
   canonical observability pattern if one is introduced in a later epic (E16).
2. (Unrelated, already tracked) Real bKash HTTP adapter behind the injected gateway
   contract remains a dependency-ready task.

## Blockers requiring human decision

None.
