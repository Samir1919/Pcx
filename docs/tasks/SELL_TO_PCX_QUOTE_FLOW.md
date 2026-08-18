# Task: Sell-to-PCX Quote Flow (4 Entry Points + Admin Indicative Pricing)

- Status: In progress
- Owner/agent: Cline
- Branch: `agent/customer-catalog-model-view-sell-quote`
- Risk: Medium (public pricing surface + RBAC-gated admin price control)
- Related epic: E3 — Sell-to-PCX, E6 — Acquisition/cost/final offer
- Related ADRs: 0001 (modular monolith), 0002 (PostgreSQL source of truth), 0003 (auth boundary)

## Objective

Customers get a redesigned Sell-to-PCX flow with 4 large entry points (Desktop PC, PC Parts, Laptop, Laptop Parts), component build dropdowns for full systems, part selection for parts entries, and a public indicative price range. Admin sets indicative price ranges (category default + per-model override) that the public quotation displays with an "estimated, not final offer" disclaimer.

## Source-of-truth references

- `AGENTS.md` (invariants, hard stops)
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md` (4.2 Sell-to-PCX)
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md` (8, 16)
- `docs/specifications/DATABASE_ERD.md` (5, 6)
- `docs/brain/domain-rules.md`, `docs/brain/database.md`

## Confirmed decisions

- D1: quotation shows a range (৳low – ৳high).
- D2: indicative price = category default + per-product-model override.
- D3: Laptop Parts ships with a small subcategory list (RAM, Storage, Battery, Keyboard, Charger, Screen).
- D4: full-system flow = customer selects each component via dropdown (no prebuilt model selection).
- D5: implement step-by-step in bounded slices.

## Scope

- S1 Taxonmy foundation: `PC Parts` + `Laptop Parts` parent groups; nest part categories; laptop-part subcategories.
- S2 Sell entry + build component domain model + `sell_requests` schema columns.
- S3 Indicative price table + admin set/get + public quote range endpoint + history.
- S4 Web sell flow: 4 big icons, component build wizard, live indicative range, submit.
- S5 Admin acquisition queue shows sell entry, components, quote range.
- S6 Tests, gates, handoff.

## Non-scope

- Final offer / valuation / physical inspection (separate E3/E6 work).
- Seller-side offer accept/reject endpoints.
- Full sell-request state machine (REVIEWING/INFO_REQUIRED/INSPECTION_REQUIRED).
- Real payment gateway and production pricing.
- Laptop Parts physical model seeds beyond the category taxonomy (parts reuse via existing catalog patterns).

## Domain invariants affected

- "Estimated seller ranges are not final offers": every public price is labelled indicative and carries a disclaimer; final offer remains inspection-gated.
- "Client input never authoritatively sets price/totals/status": indicative price is admin-set, server-validated, append-only history.
- "State transitions enforced on server": sell entry and build components validated in domain/service.

## Acceptance criteria

- [ ] Public categories expose `PC Parts`/`Laptop Parts` parent grouping with correct `parentId`.
- [ ] Sell request accepts a server-owned `sellEntry` and a validated `buildComponents` list (unique roles, matching parts category).
- [ ] Admin can set indicative price ranges (category default + model override) under `PRICING_MANAGE`.
- [ ] Public quote range endpoint returns admin-set ranges with an "estimated, not final offer" disclaimer.
- [ ] Web sell page shows 4 big icons; Desktop PC/Laptop use component dropdowns; Parts show part models.
- [ ] `npm run verify:e0`, `npm test`, lint, typecheck, build, security all pass.

## State/API/schema/UI impact

- Schema: `sell_requests` (+`sell_entry`, `build_components`); new `indicative_prices`.
- API: `POST /api/v1/admin/indicative-prices`, `GET /api/v1/quote-ranges`; sell-request create accepts new fields.
- UI: web `sell/page.js`; admin catalog/price panel + acquisition queue columns.

## Security and privacy review

- Public quote range is read-only and only exposes active indicative ranges (no cost, no private evidence, no serial).
- Admin price writes require `PRICING_MANAGE`, double-submit CSRF + origin allow-list (existing http patterns).
- Price history is append-only; actor + timestamp recorded.
- No client price is ever accepted.

## Test plan

- Unit: sell-entry/build-component domain; indicative-price domain.
- Integration: taxonomy hierarchy; indicative price repository; sell-request repository with new columns.
- Full gate: `npm run verify`.

## Migration and rollback

Additive migrations (`0024_sell_taxonomy.sql`, `0025_sell_entry_components.sql`, `0026_indicative_prices.sql`). Non-destructive. No production migration without approval.

## Prohibited changes / hard stops

No production deployment, no destructive migration, no client-authoritative price. Keep `ProductModel`/`InventoryItem` separate. Never expose acquisition cost or private evidence publicly.
