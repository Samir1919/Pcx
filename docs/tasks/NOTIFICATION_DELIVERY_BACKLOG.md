# Task Backlog: Notification & Contact Delivery Follow-ups

- Status: Ready (scheduled; not started)
- Owner: pending
- Related: `docs/handoffs/UNIFIED_CONTACT_NOTIFICATION.md`

Scheduled follow-up slices after the unified contact delivery + notification work.

## G — Storefront IntlPhoneInput + email validation UI

- Scope: reusable `IntlPhoneInput` (all countries, default BD +880) and email
  `type=email` validation on login/register/verify/account/sell/sell-requests.
- Backend normalization/anti-spam already done (`contact-normalization.mjs`).
- Acceptance: headed web check — default BD selected, country switch updates
  dial code, invalid email/phone blocked client-side.
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
