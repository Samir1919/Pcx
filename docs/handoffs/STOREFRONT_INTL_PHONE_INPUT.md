# Agent Handoff: Storefront IntlPhoneInput + Client-side Contact Validation

- Status: Complete
- Branch: `agent/storefront-intl-phone`
- Latest commit: `8ada4ac`
- Date: 2026-08-23

## Outcome

Task G of `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`. Added a reusable
international phone input (all countries, default Bangladesh +880) and
client-side email/phone validation to the customer storefront, mirroring the
server rules in `apps/api/src/modules/identity/contact-normalization.mjs`. The
server remains the authority; client validation only blocks obviously invalid
input before submit.

## Changed areas

- `apps/web/app/components/IntlPhoneInput.js` (new): searchable country dropdown,
  E.164 output `+<dial><national>`, defaults to BD.
- `apps/web/lib/countries.js` (new): ISO 3166 country/dial metadata + reverse
  lookup helpers.
- `apps/web/lib/contact-validation.js` (new): `validateEmail`, `validatePhone`,
  `validateContact` mirroring server normalization.
- `apps/web/app/{login,register,verify,account,sell}/page.js`: wired component
  and/or validation; account/sell phone fields now use IntlPhoneInput.
- `apps/web/app/globals.css`: `.phoneInput*` stylesheet additions.
- `apps/web/test/contact-validation.test.mjs` (new): unit tests.
- `scripts/web-check.mjs`: added `register` + `login` page checks.
- `scripts/storefront-e2e-check.mjs`: added `contact-validation` flow (default
  BD, country switch, invalid-email block).

## Acceptance criteria

- [x] Reusable IntlPhoneInput, default BD (+880), all countries searchable.
- [x] Country switch updates dial code (verified India +91).
- [x] Invalid email/phone blocked client-side before submit.
- [x] Real browser checks pass (not just curl).

## Verification

| Command/test | Result |
|---|---|
| `npm run verify` | Pass (547 tests, 521 pass, 0 fail, 26 skipped DB integration) |
| `npm run lint` | Pass |
| `npm run web:check` | 6/6 pass |
| `node scripts/storefront-e2e-check.mjs` | 15/15 pass |
| `node scripts/storefront-e2e-check.mjs --only contact-validation` | 3/3 pass |

## Architecture/security review

- No price/role/status/grade/server invariant changed.
- Client validation is advisory only; server normalization/abuse control remains
  the single source of truth (no client authority introduced).
- No new dependency; country data is local and static.

## Remaining work / next safe action

1. H — SHIPMENT_SHIPPED / ORDER_DELIVERED emit (needs cross-module order→user
   resolver via composition-root public method).
2. I — Provider-based MFA (SMS/Email OTP) — depends on G (now complete).
3. J — Staging compose smoke (no deploy).

## Blockers requiring human decision

None. Real provider credentials/activation remain a human hard stop.
