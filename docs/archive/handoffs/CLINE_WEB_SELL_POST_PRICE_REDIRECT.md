# Agent Handoff: Web sell post-price decision + dynamic sign-in redirect

- Status: Complete (marketplace option is a spec-approved Phase 3 placeholder; no ADR required)
- Branch: `agent/web-sell-post-price-redirect`
- Date: 2026-08-22

## Outcome

The customer sell flow (`apps/web/app/sell/page.js`) is now split into three URL-addressable steps: spec selection, a post-price "how would you like to sell?" decision screen, and the contact/fulfilment request form. The decision screen offers two paths — "Sell to PCX" (continues to the existing form) and "Advertise on marketplace" (a "coming soon" placeholder, per approved phase boundaries). Login is now a dynamic redirect: it returns the user to a validated same-origin return path instead of always landing on `/storefront`.

## Changed areas

- `apps/web/app/sell/page.js` — restructured into a `SellFlow` component wrapped in `Suspense` (for `useSearchParams`). Flow state (`entry`, `step`, `cat`, `model`, `components`) lives in the URL query so the in-progress flow survives a reload and a post-login redirect. Added the decision step and the marketplace placeholder. Sign-in links in the request step carry `?redirect=<currentPath>`.
- `apps/web/app/login/page.js` — reads a `redirect` query param at submit time and navigates to the validated return path; falls back to `/storefront`.
- `apps/web/lib/redirect.js` — new `safeReturnPath` helper that accepts only same-origin paths and rejects protocol-relative/absolute/scheme URLs (open-redirect guard).
- `apps/web/test/redirect.test.mjs` — unit tests for `safeReturnPath`.

## Acceptance criteria

- [x] Price/quote is shown before the user chooses the selling path; the decision screen separates "Sell to PCX" from "Advertise on marketplace".
- [x] "Sell to PCX" continues to the existing contact/fulfilment form.
- [x] Sign-in returns the user to the page they came from via a validated internal redirect.
- [x] Marketplace option is present but documented as future-phase (hard stop preserved).
- [x] `verify:e0`, `lint`, `typecheck`, `security`, `test`, `build` pass; `web:check --only web` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |
| `npm test` | 457 tests, 434 pass, 0 fail, 23 skipped |
| `npm run build` | Pass (application boundaries load) |
| `npm run web:check -- --only web` | Pass (home, storefront, sell) |
| Manual Playwright | decision/request steps render; request-step sign-in href is `/login?redirect=...`; login page renders with redirect param |

## Architecture/security review

- Open-redirect prevention: `safeReturnPath` only returns paths starting with a single `/` and rejects `//`, scheme-bearing values, and blank/non-path input. Login uses this at submit time.
- The `useSearchParams` suspension boundary keeps static prerender valid.
- No domain invariant changes. The marketplace path does not create listings, KYC, commissions, or payouts — it is a placeholder only, honouring `BUSINESS_PRODUCT_REQUIREMENTS.md` §23 NOT IN MVP (Phase 3). No spec change or ADR is required for this placeholder.

## Schema/configuration/deployment

None. No migrations or environment changes.

## Remaining work and next safe action

Marketplace/advertise remains Phase 3 (NOT IN MVP) and is intentionally a placeholder; no follow-up needed for MVP. The next dependency-ready MVP slice is E5 inspection execution (technician test results → evidence → health score → suggested grade), which unblocks PCX ID, grade/health, and passport completeness.

## Blockers requiring human decision

None for the Sell-to-PCX path and the marketplace placeholder. Real bKash live credentials remain a separate hard stop for the payment epic.
