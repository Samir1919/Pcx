- Status: G + H + I + J complete (storefront IntlPhoneInput + shipment/order emits + provider MFA + staging smoke)
- Latest commit: b0af85f

# Task Backlog: Notification & Contact Delivery Follow-ups

- Owner: pending
- Related: `docs/handoffs/UNIFIED_CONTACT_NOTIFICATION.md`

Scheduled follow-up slices after the unified contact delivery + notification work.

## G — Storefront IntlPhoneInput + email validation UI

- Status: Complete.
- Scope: reusable `IntlPhoneInput` (all countries, default BD +880) and email
  `type=email` validation on login/register/verify/account/sell; login/verify
  now enforce a client-side `validateContact` check before submit.
- Acceptance: default BD selected, country switch updates dial code, invalid
  email/phone blocked client-side (verified by `web:check` + storefront e2e
  `contact-validation`; 15/15 storefront e2e).
- Verification: `npm run verify` pass (547 tests, 0 fail); `npm run web:check`
  6/6; `node scripts/storefront-e2e-check.mjs` 15/15.
- Deps: none.

## H — SHIPMENT_SHIPPED / ORDER_DELIVERED emit

- Status: Complete.
- Scope: injected `orderUserResolver({ orderId }) → userId` into the shipment
  service (resolved via commerce's public `getUserIdByOrder`, never raw
  cross-module table access); emits SHIPMENT_SHIPPED on ship and ORDER_DELIVERED
  on deliver (both admin action and courier webhook / worker dispatch paths).
- Acceptance: integration test — order → shipment ship/deliver → PENDING
  notification rows; `npm run verify` green (554 tests / 0 fail).
- Deps: modular-monolith boundary preserved.

## I — Provider-based MFA (SMS/Email OTP)

- Status: Complete.
- Scope: new `provider-mfa.mjs` adapter (6-digit OTP, in-memory challenge) using
  `ContactDeliveryService` (added `MFA` purpose); wired as the default MFA in
  `auth-runtime` (lazy holder avoids the authService↔providerConfig cycle);
  auth-service maps a `beginChallenge` failure to `mfa_unavailable` (fail closed).
- Acceptance: provider-mfa unit tests (deliver/verify/fail-closed) + auth-service
  fail-closed test; `npm run verify` green (560 tests / 0 fail).
- Deps: G completion preferable.

## J — Staging compose smoke (no deploy)

- Status: Complete.
- Scope: extended `infra/docker-compose.staging.yml` to a full production-like
  stack (postgres/redis/minio + migrate/api/worker/web/admin + Caddy proxy on
  isolated ports 8082/8083); added `scripts/staging-smoke.mjs` + `npm run
  staging:smoke` (up --build → wait api ready → probe web/admin proxy → down).
- Acceptance: `npm run staging:smoke` PASS (api/web/admin healthy), isolated
  `pcx-staging` project, synthetic credentials only.
- Deps: D2/D3 (dev docker) completion.
