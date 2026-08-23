# Agent Handoff: Unified Contact Delivery + Notification Providers + Anti-spam

- Status: Complete (backend + admin); S4 storefront IntlPhoneInput deferred
- Branch: `main`
- Latest commit: `c680817`
- Date: 2026-08-23

## Outcome

- Contact-normalization (EMAIL/PHONE) + per-contact abuse control wired into
  register, login, and verify/reset request.
- EMAIL (Resend) + SMS (bdBulksms) provider credential config (sandbox/live,
  AES-256-GCM encrypted, masked admin view, server-owned activation).
- Synchronous ContactDeliveryService routes verify/reset OTP through the active
  provider (no more no-op delivery).
- Asynchronous notification outbox: deterministic event emitter + idempotent
  repository insert, lifecycle emits for ORDER_PLACED / OFFER_CREATED /
  SELL_REQUEST_SUBMITTED, and worker resolves admin-configured dispatchers.

## Changed areas

- `apps/api/src/modules/identity/contact-normalization.mjs` (new)
- `apps/api/src/modules/identity/auth-abuse-control.mjs` (per-contact dimension)
- `apps/api/src/modules/identity/{auth-service,identity-action-service}.mjs`
- `apps/api/src/modules/notification/*` (provider config, dispatchers, emitter,
  contact delivery, HTTP)
- `apps/worker/src/composition.mjs` (configured dispatcher resolution)
- `apps/api/src/modules/{commerce/acquisition}/...` (lifecycle emit)
- `apps/admin/.../notifications/*` + `apps/admin/lib/notification-provider-api.js`
- `apps/api/migrations/0022_notification_provider_config.sql`
- `scripts/admin-e2e-check.mjs` (provider tabs regression)

## Acceptance criteria

- [x] Verify/reset OTP routed through active EMAIL/SMS provider (service-level).
- [x] Provider credentials masked, encrypted, partial-save, server-owned activation.
- [x] Event emit is idempotent and non-fatal to business transactions.
- [x] Admin Providers tab renders Email/SMS and masks credentials.
- [x] `npm run verify` pass (543 tests, 517 pass, 0 fail, 26 skipped).

## Verification

| Command/test | Result |
|---|---|
| `npm test` | 543 total, 517 pass, 0 fail, 26 skipped |
| `npm run lint` | Pass |
| `PCX_HEADED=1 node scripts/admin-e2e-check.mjs` | 26/26 pass |
| `npm run verify` | Pass |
| `node scripts/merge-gate.mjs` | OK: main merged into origin/main |

## Architecture/security review

- No price/total/role/status/grade invariant changed.
- Notification emit is best-effort, post-success, non-fatal; delivery failure
  never rolls back a business transaction.
- Provider credentials AES-256-GCM encrypted at rest (reuses payment cipher);
  never returned in plaintext, never committed.
- Live provider activation remains human-authorized (hard stop); only sandbox
  dispatch verified.

## Schema/configuration/deployment

- Additive migration `0022_notification_provider_config.sql`.
- No env/credential committed. `PAYMENT_CREDENTIALS_KEY` reused for notification
  credential encryption.

## Remaining work / next safe action

1. S4 storefront `IntlPhoneInput` component (all countries, default BD +880) and
   email validation UI on login/register/sell/account/verify/reset. Backend
   normalization/anti-spam is already in place; the UI is the remaining chunk.
2. SHIPMENT_SHIPPED / ORDER_DELIVERED emit — customer-id resolution for a
   shipment requires a cross-module order→user lookup (deferred to avoid a
   module-boundary violation).
3. Provider-based MFA (SMS/Email OTP) to replace dev-MFA (separate slice).
4. Real Resend / bdBulksms live activation (human hard stop).

## Blockers requiring human decision

None. Real provider credentials/activation remain human hard stop.
