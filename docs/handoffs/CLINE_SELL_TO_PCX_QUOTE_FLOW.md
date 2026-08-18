# Agent Handoff: Sell-to-PCX Quote Flow (4 Entry Points + Admin Indicative Pricing)

- Status: Complete
- Branch: `agent/customer-catalog-model-view-sell-quote`
- Latest commit: `d6b92cd`
- Date: 2026-08-18

## Outcome

The Sell-to-PCX flow now offers four public entry points (Desktop PC, PC Parts, Laptop, Laptop Parts). Full-system entries use component dropdown wizards; parts entries show only part models. A public indicative price range (with a final-offer disclaimer) is displayed from admin-set, server-owned, append-only indicative prices (model > category override). Admin acquisition queue shows the sell entry and build components.

## Changed areas

- `apps/api/migrations/0024_sell_taxonomy.sql` — `PC Parts`/`Laptop Parts` parent groups, laptop-part subcategories, reparenting of desktop part categories.
- `apps/api/migrations/0025_sell_entry_components.sql` — `sell_requests.sell_entry` + `build_components`.
- `apps/api/migrations/0026_indicative_prices.sql` — `indicative_prices` with one-active-per-target partial unique indexes.
- `packages/domain/src/acquisition/sell-entry.mjs` — `SellEntry`, `BuildComponentRole`, component validation.
- `packages/domain/src/pricing/indicative-price.mjs` — money-validated indicative price, archive, public projection.
- `apps/api/src/modules/acquisition/*` — sell request persists/returns entry + components.
- `apps/api/src/modules/pricing/*` — repository/service/http for admin price + public quote range.
- `apps/api/src/server.mjs`, `apps/api/src/modules/identity/auth-runtime.mjs` — routing/wiring.
- `apps/web/app/sell/page.js`, `apps/web/lib/storefront-api.js`, `apps/web/app/globals.css` — redesigned web sell flow.
- `apps/admin/app/(workspace)/acquisition/page.js` — queue columns.

## Acceptance criteria

- [x] Public categories expose `PC Parts`/`Laptop Parts` with correct `parentId`.
- [x] Sell request accepts server-owned `sellEntry` + validated unique-role `buildComponents`.
- [x] Admin sets indicative ranges (category default + model override) under `PRICING_MANAGE`.
- [x] Public quote range endpoint returns admin-set range with "estimated, not final offer" disclaimer.
- [x] Web sell page shows 4 big icons; Desktop PC/Laptop use component dropdowns; Parts show part models.
- [x] `verify:e0`, lint, typecheck, security pass; new tests pass.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |
| New unit/service/http/repository tests | Pass (S2 13, S3 11 + 1 integration) |
| `npm test` (full) | 433 pass, 3 fail — pre-existing (auth-http, listing demo data, ai-adapters), unrelated to this change |
| `npm run build` | Not verified: Node v26.4.0 vs `.nvmrc`/engines `>=22 <23`; Next `/_global-error` prerender fails pre-existing |

## Architecture/security review

- "Estimated seller ranges are not final offers" preserved: every public range carries the disclaimer; final offer stays inspection-gated.
- "Client input never authoritatively sets price": indicative price is admin-set, positive, low<=high validated, append-only.
- Public quote range exposes only low/high/target/disclaimer — no cost, serial, admin actor, or evidence.
- Admin price write requires PRICING_MANAGE + CSRF + origin; model > category precedence.
- No invariant regression; no ADR change required.

## Schema/configuration/deployment

Additive migrations `0024`, `0025`, `0026`. Non-destructive. No production deployment.

## Remaining work and next safe action

1. Admin UI for creating indicative prices (backend endpoints + tests are in place).
2. Fix the Offer form mismatch (`expiresAt` required by domain, not sent by admin UI) and `publicRequestNo` generation.
3. Sell request detail view + remaining REVIEWING/inspection/offer state machine.

## Blockers requiring human decision

None.
