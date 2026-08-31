# Handoff: APPROVED-only list gate + ui-guard status parse fix

- Branch: main
- Scope: (1) only APPROVED inventory items may be listed — server-side guard in
  listing createDraft + disabled List button on the inventory page for other
  statuses; (2) fix browser-verify-guard so a `git status --short` first line
  keeps its leading status column (was stripped by .trim(), breaking the
  filename parse).
- Acceptance: npm run verify passes (588 tests, 0 fail); headed browser shows
  APPROVED rows with an enabled List button and RECEIVED rows with it disabled.
- Changed: listing-service (findInventoryItemStatus + createDraft APPROVED gate +
  item_not_approved), postgres-listing-repository (findInventoryItemStatus),
  listing-http (ITEM_NOT_APPROVED map), inventory page (List disabled unless
  APPROVED), browser-verify-guard (trimTrailingNewlines), tests.
- Decisions: the APPROVED gate enforces the existing spec invariant "Listing =
  commercial offer for an approved Inventory Item" (no invariant change, only
  enforcement). findInventoryItemStatus is a read-only cross-module query, which
  is allowed under the modular-monolith boundary (reads only, no writes).
- Risks: existing RECEIVED items can no longer be listed until inspected +
  approved — intended. Demo item PCX-691E700B was set APPROVED/A_PLUS/92 earlier
  for grade-label verification.
- No blockers.
