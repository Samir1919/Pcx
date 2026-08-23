- Status: G complete (storefront IntlPhoneInput + contact validation UI)
- Latest commit: 8ada4ac

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

- Scope: inject `orderUserResolver({ orderId }) → userId` into shipment service
  (via a composition-root public method, not raw cross-module table access);
  emit after ship/deliver.
- Acceptance: integration test — order → shipment ship/deliver → PENDING
  notification row; `npm run verify` green.
- Deps: modular-monolith boundary preserved.

## I — Provider-based MFA (SMS/Email OTP)

- Scope: new provider-MFA adapter using `ContactDeliveryService`; inject as
  `mfa` in `auth-runtime`. Fail-closed when provider config absent.
- Acceptance: auth-service MFA tests + integration (sandbox) + headed login flow.
- Deps: G completion preferable.

## J — Staging compose smoke (no deploy)

- Scope: `infra/docker-compose.staging.yml` synthetic creds `up -d --build`;
  curl health/web/admin home; `down`.
- Acceptance: all services healthy in dockerized stack.
- Deps: D2/D3 (dev docker) completion.
