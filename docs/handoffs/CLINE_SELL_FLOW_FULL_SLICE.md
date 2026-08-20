# Agent Handoff: Sell Flow + Pricing + State Machine (Slices A–D)

- Status: Complete
- Branch: `agent/sell-taxonomy-config`
- Date: 2026-08-20

## Outcome

Four bounded slices, each verified, committed, and pushed:

1. **Slice A** — Sell-to-PCX entry/build config moved from hardcoded web
   constants into PostgreSQL (`sell_entry_config`, `sell_build_components`),
   with public + admin APIs and Catalog "Sell flow" admin UI.
2. **Slice B** — Removed the hardcoded `PLACEHOLDER_RANGES` pricing duplicate;
   sell-request create now resolves estimated range from the single
   server-owned indicative price service. Moved the indicative-quote admin UI
   from Acquisition to Catalog.
3. **Slice C** — Implemented the canonical sell-request state machine
   (ADR 0011) with a server-enforced transition graph and admin transition
   endpoint.
4. **Slice D** — Added sequence-backed server-owned `publicRequestNo`
   (`SR-000001`) and state-driven actions in the admin acquisition queue.

## Commits

- `812f972` + `7e07dd6` — Slice A + status note
- `51f65c8` — Slice B
- `7e33a34` — Slice C + ADR 0011
- `6e28e9e` — Slice D

## Changed areas (high level)

- Migrations: `0030_sell_taxonomy.sql`, `0031_sell_request_state_machine.sql`,
  `0032_sell_request_public_no.sql` (all additive, non-destructive).
- Domain: `sell-taxonomy.mjs` (new), `sell-request.mjs` (state graph),
  `index.mjs` exports, domain tests.
- API: catalog sell-taxonomy repo/service/http, acquisition sell-request
  repo/service/http (transition + public no), wiring in `auth-runtime.mjs` +
  `server.mjs`.
- Admin: Catalog "Sell flow" + "Quotes" tabs; Acquisition state-driven queue.
- Web: `sell/page.js` + `storefront-api.js` derive sell flow from API.
- ADR: `0011-sell-request-state-machine-reconciliation.md`.

## Verification

| Gate | Result |
|---|---|
| `npm test` | 449 pass, 0 fail, 26 skipped |
| `npm run verify:e0` | Pass (36 artifacts) |
| `node scripts/lint-check.mjs` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |
| DB integration (`migrations`, `sell-taxonomy-repository`, `sell-request-repository`) | Pass against local Postgres |

## Architecture/security review

- Categories remain the single catalog source of truth; sell config is a thin
  FK overlay (no duplicate taxonomy).
- Icon stored as curated `icon_key`; web maps to emoji (no raw injection).
- Admin writes are `CATALOG_MANAGE` / `PRICING_MANAGE` / `ACQUISITION_PAYMENT_MANAGE`
  gated with CSRF + allowed-origin + audit.
- Public numbers and lifecycle state are server-owned; clients never set them.
- No core invariant or pricing-policy change; production deploy not attempted.

## Remaining work (future, outside this branch's bounded scope)

- Seller-facing accept/reject offer endpoints (currently admin-side only).
- Full valuation/offer/inspection media flows and notifications.
- §12 text amendment to cite ADR 0011 the next time it is edited.
