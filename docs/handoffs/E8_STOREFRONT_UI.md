# Agent Handoff: E8 Storefront UI Shell (apps/web)

- Status: Complete
- Branch: `main`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

The customer-facing storefront UI shell is live in `apps/web` as a responsive Next.js app. It consumes the public read surface only — catalog categories/brands, published listing search (`GET /api/v1/listings`), and the public passport (`GET /api/v1/passport/:pcxId`) — and never renders serials, acquisition cost, or private evidence.

## Changed areas

- `apps/web/package.json`: Next.js + React deps (mirrors `apps/admin`).
- `apps/web/next.config.mjs`: proxies `/api/:path*` to the API origin (`PCX_API_ORIGIN`, default `http://127.0.0.1:4000`).
- `apps/web/app/layout.js`, `apps/web/app/globals.css`: root layout + storefront styling.
- `apps/web/app/page.js`: redirects `/` → `/storefront`.
- `apps/web/lib/storefront-api.js`: read-only fetch adapter for public endpoints.
- `apps/web/app/storefront/page.js` + `workspace.js`: listing search with category/brand filter, sort, cursor pagination.
- `apps/web/app/passport/[pcxId]/page.js`: public passport read.
- `apps/web/test/storefront-api.test.mjs`: adapter tests.
- `apps/web/README.md`: run instructions.
- `docs/tasks/E8_STOREFRONT_UI.md`: bounded task spec (Complete).
- `docs/status/PROJECT_STATUS.md`: E8 epic + verification baseline updated.

## Acceptance criteria

- [x] `apps/web` boots as a Next.js app and proxies `/api/:path*` to the API origin.
- [x] Storefront page lists published listings with safe disclosure fields only.
- [x] Category/brand filter, sort, and cursor pagination work against `GET /api/v1/listings`.
- [x] Passport page renders the public passport for a `pcxId`.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm install` | Pass: 0 vulnerabilities |
| `node --test apps/web/test/storefront-api.test.mjs` | Pass: 3/3 |
| `npm run verify` | Pass: 210 application/unit (188 pass + 22 DB-skipped), build + security pass |
| Storefront page `GET /storefront` | HTTP 200 |
| Home redirect `GET /` | HTTP 307 → `/storefront` |
| Web proxy `GET /api/v1/listings?limit=5` | HTTP 200 |
| Web proxy `GET /api/v1/categories` | HTTP 200 |
| Passport page `GET /passport/PCX-TEST-LIST` | HTTP 200 |

## Architecture/security review

Read-only public surface. No write endpoints exposed. Listing cards and passports use only approved disclosure fields (no serial/cost/private evidence). Prices are server-set by PCX. No hard stop bypassed.

## Schema/configuration/deployment

No schema change. New Next.js app under `apps/web`. No API change (consumes existing public endpoints).

## Remaining work and next safe action

1. E8 listing media/QR and reservation/sold transitions.
2. E6 acquisition payment and cost allocation.
3. E7 listing media/QR and disclosure completeness.
4. Stage 2: container image scan + sandbox payment/courier/notification adapters.

## Blockers requiring human decision

None. Production deployment and real provider credentials remain hard stops.
