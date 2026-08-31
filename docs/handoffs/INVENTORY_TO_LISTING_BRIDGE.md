# Handoff: inventory -> draft listing bridge (List button)

- Branch: main
- Scope: add a per-item "List" action on the admin Inventory page that calls
  listingApi.createDraft with the item's id, so a registered (RECEIVED/APPROVED)
  item flows to a DRAFT listing without typing a raw inventory UUID into the
  Listings page. Completes the acquisition -> intake -> list -> publish -> price
  -> storefront loop.
- Acceptance: npm run verify passes (584 tests, 0 fail); headed browser
  click-through: inventory -> List -> draft created (POST /api/v1/admin/listings
  201) -> publish -> set price -> storefront shows the item (Blue 1TB HDD,
  ৳15,000, CERTIFIED). ui-guard accepted the committed headed evidence.
- Changed: apps/admin/app/(workspace)/inventory/page.js (List button + handler),
  docs/verify/browser-verify.json (headed evidence), docs/status/PROJECT_STATUS.md
  (E7 verified scope + evidence commit).
- Decisions: the List button creates a DRAFT only (server-owned status);
  publish + price stay separate server-owned actions on the Listings page.
  No server change needed — the existing listing createDraft already accepts
  inventoryItemId.
- Risks: none material. The listing domain still does not enforce "APPROVED
  before list" (spec intent); a future slice could gate the button on item status.
- No blockers.

Note (pre-existing, not fixed in this slice): scripts/browser-verify-guard.mjs
git() helper does .trim() on `git status --short` output, which strips the
leading space of the first unstaged file and breaks slice(3) parsing (yields
"pps/..." instead of "apps/..."). It only bites when ui-guard runs with unstaged
UI files; the committed-diff path (git diff origin/main...HEAD) is unaffected.
