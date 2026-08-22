# Agent Handoff: CLINE_AUDIT_FIX_12 — Admin API client consolidation

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: dc507c0
- Date: 2026-08-17

## Outcome

`catalog-api.js` and `payment-api.js` now delegate to the shared
`apiRequest`/`ApiError`, and are reformatted to multi-line code. Legacy aliases
(`CatalogApiError`, `PaymentApiError`, `csrfToken`) remain exported.

## Changed areas

- `apps/admin/lib/catalog-api.js`, `apps/admin/lib/payment-api.js`.

## Verification

| Command | Result |
|---|---|
| `node --test apps/admin/test/catalog-api.test.mjs apps/admin/test/auth-api.test.mjs` | 6/6 pass |
| `npm test` | 338 pass, 22 skip, 0 fail |

## Remaining work

- Item #13: dead `/catalog` nav link in apps/web.
- Item #14: duplicate `money()` formatter in apps/web.
- Item #15: missing error boundaries in both frontend apps.
- Item #16: admin auth route guard (401 handling dedup).
- Item #17: dead stub packages.

## Blockers

Item #8 (dispatcher wiring) needs a human decision.
