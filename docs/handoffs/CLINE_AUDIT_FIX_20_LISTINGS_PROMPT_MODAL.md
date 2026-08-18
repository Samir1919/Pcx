# Agent Handoff: Replace Unsupported `prompt()` with Modal Dialog in Listings

- Status: Complete
- Branch: `agent/fix-admin-listings-prompt-modal`
- Latest commit: `adc372e`
- Date: 2026-08-18

## Outcome

The admin Listings workspace (`apps/admin/app/(workspace)/listings/page.js`) used the
native `window.prompt(...)` API for two actions — publishing a DRAFT listing (collecting a
canonical public slug) and setting an asking price. `window.prompt` is not supported by the
Next.js 16.3.1 Turbopack runtime and threw `prompt() is not supported` at runtime when either
button was clicked. Both actions now use an in-app React modal dialog rendered through
`createPortal`, matching the existing modal pattern already used by the web passport modal.

The server contract is unchanged: publish still posts `{ publicSlug }` to
`POST /api/v1/admin/listings/:id/publish`, and price still posts
`{ listingId, price, reason: "admin-set" }` to `POST /api/v1/admin/listings/prices`. Slug and
price are validated client-side (canonical slug regex, positive number) before submission, and
the server remains authoritative for all validation.

Fix two: publishing a DRAFT whose `inventory_item_id` already has a PUBLISHED/RESERVED listing
(or whose public slug already exists) tripped the `listings_one_active_per_item` / `public_slug`
unique constraints. The publish path did not map Postgres code `23505`, so it surfaced as a
generic `500 INTERNAL_ERROR / "Unexpected server error"`. The publish service now maps `23505`
to `ListingError("conflict")`, which the HTTP layer already maps to a clean
`409 LISTING_CONFLICT / "Listing conflicts with existing data"`.

## Changed areas

- `apps/admin/app/(workspace)/listings/page.js`
  - Removed both `window.prompt` calls.
  - Added a reusable `FieldDialog` component rendered via `createPortal` to `document.body`,
    with ESC/overlay/close-button dismissal, autofocus, Enter-to-submit, and inline validation
    errors.
  - Added `parseSlug` and `parsePrice` validators to reject invalid input client-side before
    the API call.
  - `publish(listing, publicSlug)` and `setPrice(listing, price)` now receive validated values
    instead of prompting themselves.
- `apps/admin/app/globals.css`
  - Added modal styles (`.modalOverlay`, `.modalDialog`, `.modalClose`, `.modalActions`,
    `.dialogError`) consistent with the existing admin design tokens and the web app's modal.
- `apps/api/src/modules/listing/listing-service.mjs`
  - `publish` now wraps the repository call and maps Postgres `23505` (duplicate active
    listing per inventory item, or duplicate public slug) to `ListingError("conflict")`.
- `apps/api/test/listing-service.test.mjs`
  - Added a regression test asserting `23505` maps to `conflict` and an unrelated error stays
    unmapped.

## Acceptance criteria

- [x] Clicking "Publish" on a DRAFT listing opens a modal to enter a canonical public slug (no `prompt()`).
- [x] Clicking "Set price" opens a modal to enter a positive price (no `prompt()`).
- [x] Invalid slug/price shows an inline error and does not call the API.
- [x] Valid submissions preserve the exact server API contract (`publish` and `setPrice` bodies unchanged).
- [x] Admin production build compiles successfully (Next 16.3.1 / Turbopack).
- [x] Publishing a conflicting listing returns a clean 409 `LISTING_CONFLICT` (not a 500).

## Verification

| Command/test | Result |
|---|---|
| `npm run build --workspace @pcx/admin` | Pass — compiled successfully, `/listings` route generated |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run verify:e0` | Pass — 36 required artifacts |
| `node --test apps/admin/test/listing-api.test.mjs` | Pass — 2/2 |
| `node --test apps/api/test/listing-service.test.mjs apps/api/test/listing-http.test.mjs` | Pass — 12/12 |
| `npm run verify` (full) | Pass — E0, lint, typecheck, tests (405 total, 383 pass, 0 fail, 22 skipped), build, security |
| `npm run security` | Pass |

## Architecture/security review

- No domain invariants, source-of-truth specs, or ADRs affected. The client change is UI-only;
  the server change only reclassifies an existing database constraint violation into a clean,
  client-visible conflict without weakening any invariant (the one-active-listing-per-item and
  unique-slug constraints remain enforced at the database level).
- Server stays authoritative for slug canonicalization, pricing validity, status transitions,
  and authorization (`PRICING_MANAGE`/`PRICING_READ` via the listing service). Client-side
  validation is guidance only and cannot weaken server enforcement.
- No secrets, credentials, or production policy involved. No hard stop triggered.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

1. The sibling admin workspaces (`catalog/workspace.js` and `payments/workspace.js`) still use
   `window.prompt` / `window.confirm` for edit/archive/activate actions. They have not failed in
   this report, but they use the same unsupported `window.*` dialogs and should be migrated to
   the same modal pattern as a bounded follow-up.
2. Merge `agent/fix-admin-listings-prompt-modal` back to `main` after review (normal repository
   merge gate).

## Blockers requiring human decision

None.
