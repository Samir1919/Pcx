# Handoff: human-readable inventory + listings UI

- Branch: main
- Scope: inventory and listings admin pages showed raw UUIDs + status codes.
  Enrich read projections and render readable product/condition/status/price.
- Acceptance: npm run verify passes (586 tests, 0 fail); headed browser shows
  inventory table/detail and listings table with product name, brand · category,
  condition grade, labeled status, formatted ৳ price, serial, and acquisition cost.
- Changed: inventory postgres repo (list/findById JOIN product_models/brands/
  categories + condition/health/approved + primary serial in detail); listing
  repo listAdmin (brand/category/grade/health) + service mapping; new
  apps/admin/lib/ui-format.js (status/grade labels + tones, formatPrice, formatDate)
  + tone pill CSS; inventory + listings pages + detail modal; tests.
- Decisions: read projections enriched at the repository SQL level (no migration —
  columns already exist). Serial + acquisition cost only in the admin detail modal
  (INVENTORY_MANAGE/pricing), never in the list or public surface.
- Risks: none material. Condition shows "—" until an item is inspected + approved
  (grade is null for RECEIVED), which is correct.
- No blockers.
