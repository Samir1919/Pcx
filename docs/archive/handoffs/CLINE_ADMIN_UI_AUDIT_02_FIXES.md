# Agent Handoff: Admin panel — responsive, sidebar, and payments fixes

- Status: Complete
- Branch: `agent/admin-ui-responsive-fixes`
- Date: 2026-08-18

## Outcome

Fixed the admin panel issues found in the manual UI audit (`CLINE_ADMIN_UI_AUDIT_01.md`):
the Payments workspace now loads, partial credential saves preserve existing fields,
the collapsed (tablet) sidebar shows distinct icons and keeps a visible sign-out
control, and the mobile nav shows full scrollable labels.

## Changed areas

- `apps/api/src/modules/payment/payment-provider-config-http.mjs`
  — `security()` (Origin + CSRF double-submit) now runs only for mutating
  requests (`PUT config` / `POST activate`), not for `GET config`. Same-origin
  browser GETs never send an `Origin` header, so the list call previously always
  failed with `403 ORIGIN_DENIED`. Authorization is still enforced by the service.

- `apps/api/src/modules/payment/payment-provider-config-service.mjs`
  — `saveConfig` now merges incoming credentials over the existing stored ones
  (decrypted via the injected cipher) before normalizing, so omitted fields keep
  their current values instead of being wiped.

- `apps/admin/app/user-shell.js`
  — added `data-short` attributes so the collapsed sidebar renders distinct
  single-letter/icon labels for each menu item.

- `apps/admin/app/globals.css`
  — `nav a:after` now uses `attr(data-short)` (distinct labels), the collapsed
  sidebar keeps a visible (icon-only) sign-out button while hiding the verbose
  `.secure` description, and the mobile nav shows full, horizontally scrollable
  labels instead of cryptic single letters.

- `apps/api/test/payment-provider-config-http.test.mjs` (new)
  — regression tests for the GET read path and mutation CSRF/Origin enforcement.

- `apps/api/test/payment-provider-config-service.test.mjs`
  — added a test that partial updates preserve previously saved credentials.

## Acceptance criteria

- [x] `/api/v1/admin/payment-providers/{provider}/config` GET returns 200 without an Origin/CSRF header.
- [x] `PUT config` and `POST activate` still fail closed without valid Origin + CSRF.
- [x] Partial credential save preserves existing (omitted) fields.
- [x] Collapsed sidebar icons are distinct and keep a sign-out control.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/payment-provider-config-http.test.mjs apps/api/test/payment-provider-config-service.test.mjs` | 12/12 pass |
| `npm test` | 365 tests: 343 pass, 22 skip, 0 fail |
| `npm run verify` | e0 + lint + typecheck + test + build + security all pass |
| Live replay (restarted API) | `GET .../bkash/config` → `200 {"data":[]}` (was `403 ORIGIN_DENIED`) |

## Architecture/security review

- No invariant change. Write operations keep their Origin + CSRF double-submit
  gate; only the read (list) path was relaxed to match sibling handlers
  (`inventory-http.mjs`, `inspection-template-http.mjs`).
- Credential plaintext is still never exposed (masked projection retained).
- Sensitive-surface change (payments) reviewed and covered by new tests.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

1. Paginate the Catalog "Product models" list using `meta.nextCursor` (523 ACTIVE models currently truncated to 50).
2. Make dashboard stat labels match status-filtered counts.
3. Remove the dead empty route dirs `apps/admin/app/{catalog,inventory,verification,audit}`.

## Blockers requiring human decision

None.
