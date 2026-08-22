# Handoff: Admin panel UI manual audit (findings only)

- Status: Audit complete (findings reported; no code changed)
- Branch: main (working tree clean)
- Date: 2026-08-17
- Scope: Manually visit every admin route and cross-check the rendered data flow against the live API (`http://127.0.0.1:4000`, admin rewrite on `:3001`) using the seeded `demo-admin` account with dev MFA.

## Method

- Read every `apps/admin` page/shell/lib file and the backing API handlers/services/repositories.
- Authenticated as `demo-admin@example.com` via `login` → `verify-mfa`.
- Replayed each admin GET endpoint through the Next.js `/api` rewrite exactly as the browser would (same-origin GET with cookies, no `Origin` header).
- Verified response shapes against the fields the UI reads.

## Confirmed problems

### 1. Payments workspace cannot load configuration (functional bug)
`apps/admin/lib/payment-api.js` → `paymentApi.configs()` issues a same-origin GET to
`/api/v1/admin/payment-providers/{provider}/config`.

`apps/api/src/modules/payment/payment-provider-config-http.mjs` runs `security()`
(Origin + CSRF double-submit) for **all** methods, including GET. Browsers do
not send an `Origin` header on same-origin GET, so the load always fails with
`403 {"code":"ORIGIN_DENIED"}`.

- Reproduced through the rewrite: `GET /api/v1/admin/payment-providers/bkash/config` → `403 ORIGIN_DENIED`.
- Effect: the Payments page shows the error banner "Request origin is not allowed"
  forever, `current` is never populated, and the "Activate this mode" button stays
  permanently disabled. Existing bKash sandbox/live config can never be viewed or activated from the UI.

### 2. Catalog "Product models" silently truncated to 50, no pagination
`apps/admin/lib/catalog-api.js` hardcodes `models()` = `/api/v1/product-models?limit=50`.
`apps/admin/app/(workspace)/catalog/workspace.js` ignores the `meta.nextCursor`
the API returns.

- Live DB has **523 ACTIVE** product models, but the tab badge and table only ever
  show 50. The other 473 models (and their specifications links) are unreachable.

### 3. Dashboard stat labels misrepresent the data
`apps/api/src/modules/reporting/postgres-operations-report-repository.mjs` `counts()`
counts all rows without status filters:
`users`, `listings`, `return_requests`, `claims`.

`apps/admin/app/(workspace)/page.js` renders them as:

| UI label | data key (unfiltered source) |
|---|---|
| Customers | `users` (ok) |
| Listings | `activeListings` = count of **all** listings |
| Returns | `pendingReturns` = count of **all** return_requests |
| Open claims | `openClaims` = count of **all** claims |

So "Open claims" shows total claims regardless of status (and the same mismatch
applies to `activeListings` / `pendingReturns`).

### 4. Payments "Leave a field blank to keep its current value" is false
`apps/admin/app/(workspace)/payments/workspace.js` builds `credentials` only from
non-blank fields. `saveConfig` then stores exactly that object and
`postgres-payment-provider-config-repository.mjs` `upsert` replaces the whole
encrypted blob (`ON CONFLICT … DO UPDATE SET encrypted_credentials = EXCLUDED…`).
Blank fields are **dropped**, not preserved — contradicting the on-screen hint and
risking partial credential wipes.

### 5. Collapsed sidebar icons are all identical
`apps/admin/app/globals.css` (≤980px): `nav a:after { content: "C" }` gives every
nav item the same letter "C", so Overview / Catalog / Inventory / Verification /
Payments / Audit are indistinguishable when the sidebar collapses.

### 6. Dead empty route directories (minor cleanup)
`apps/admin/app/{catalog,inventory,verification,audit}` exist but contain no files.
They add no routes, but are leftover clutter after the earlier consolidation.

## Non-issues verified (no action needed)

- All other pages load and render the API shape they read: Overview, Catalog
  (categories/brands/definitions/model specifications), Inventory, Verification,
  Audit, Login, Register.
- Credential payloads are masked (`maskCredentials`) before display; no secret leak.
- Server-side authorization/state invariants remain enforced (only GET endpoints
  were exercised here; writes were not performed).

## Recommendation

Primary fix: gate `security()` in `payment-provider-config-http.mjs` to non-GET
methods (mirror `inventory-http.mjs`/`inspection-template-http.mjs`), then verify
`/payments` loads and the existing tests pass.
