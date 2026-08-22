# Agent Handoff: Web sell post-price decision + dynamic sign-in redirect

- Status: Complete (Part A) / Proposed-ADR only (Part B)
- Branch: `agent/web-sell-post-price-redirect`
- Date: 2026-08-22

## Outcome

The customer sell flow (`apps/web/app/sell/page.js`) is now split into three URL-addressable steps: spec selection, a post-price "how would you like to sell?" decision screen, and the contact/fulfilment request form. The decision screen offers two paths — "Sell to PCX" (continues to the existing form) and "Advertise on marketplace" (a "coming soon" placeholder, per approved phase boundaries). Login is now a dynamic redirect: it returns the user to a validated same-origin return path instead of always landing on `/storefront`.

## Changed areas

- `apps/web/app/sell/page.js` — restructured into a `SellFlow` component wrapped in `Suspense` (for `useSearchParams`). Flow state (`entry`, `step`, `cat`, `model`, `components`) lives in the URL query so the in-progress flow survives a reload and a post-login redirect. Added the decision step and the marketplace placeholder. Sign-in links in the request step carry `?redirect=<currentPath>`.
- `apps/web/app/login/page.js` — reads a `redirect` query param at submit time and navigates to the validated return path; falls back to `/storefront`.
- `apps/web/lib/redirect.js` — new `safeReturnPath` helper that accepts only same-origin paths and rejects protocol-relative/absolute/scheme URLs (open-redirect guard).
- `apps/web/test/redirect.test.mjs` — unit tests for `safeReturnPath`.
- `docs/adr/0010-open-marketplace-advertise-flow.md` — Proposed ADR that must be accepted (plus a spec scope change) before implementing the full marketplace/advertise flow.

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
- No domain invariant changes. The marketplace path does not create listings, KYC, commissions, or payouts — it is a placeholder only, honouring `BUSINESS_PRODUCT_REQUIREMENTS.md` §23 NOT IN MVP.
- Marketplace enablement is a hard stop: see ADR `0010` (Proposed) and the blocker below.

## Schema/configuration/deployment

None. No migrations or environment changes.

## Remaining work and next safe action

1. Accept ADR `0010` and update `BUSINESS_PRODUCT_REQUIREMENTS.md` (move marketplace into the MVP boundary) — required before any marketplace code.
2. Backend slice for third-party marketplace listings (separate from PCX-owned `listings`), KYC-gated seller eligibility, and PCX-recorded final price/publication.
3. Merchant-facing advertise form and public distinction between PCX-owned and third-party listings.
4. Finance-reviewed payout/commission records (idempotent, delivery-gated).

## Blockers requiring human decision

Full marketplace/advertise implementation is blocked pending explicit human approval of ADR `0010` and the spec phase change (core MVP scope + source-of-truth change).
