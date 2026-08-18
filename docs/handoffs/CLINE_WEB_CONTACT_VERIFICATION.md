# Agent Handoff: Web Contact Verification (dev demo code)

- Status: Complete
- Branch: `main`
- Date: 2026-08-19

## Goal
Mirror the admin dev-MFA pattern for customer contact verification. A newly
registered web customer stays PENDING_VERIFICATION and must enter a dev
verification code to activate. Verified customers can then sign in.

## What was built

### Backend
- `apps/api/src/modules/identity/dev-contact-verifier.mjs` (new): deterministic
  dev code (`PCX_DEV_VERIFY_CODE`, default `123456`), injected only in
  development.
- `apps/api/src/modules/identity/identity-action-service.mjs`: added
  `verifyContactByCode({ contact, credential })` which validates against the
  injected `contactVerifier` and activates the PENDING_VERIFICATION account;
  fails closed when no verifier is wired (production).
- `apps/api/src/modules/identity/postgres-identity-repository.mjs`: added
  `activateByContact(contact, now)`.
- `apps/api/src/modules/identity/auth-http.mjs`: added
  `POST /api/v1/auth/verify-contact-code` (`{ contact, code }`).
- `apps/api/src/modules/identity/auth-runtime.mjs`: wires the dev verifier only
  when `NODE_ENV === "development"`.

### Web
- `apps/web/app/verify/page.js` (new): contact + code form.
- `apps/web/app/register/page.js`: on success redirects to `/verify?contact=...`.
- `apps/web/app/StorefrontNav.js`: added a "Verify" link for signed-out users.
- `apps/web/lib/storefront-api.js`: added `verifyContactCode(contact, code)`.

## Verification
- `node --test apps/api/test/identity-action-service.test.mjs` → pass (incl. new
  dev-code verification test).
- Playwright end-to-end: register → `/verify` → code `123456` → login →
  `/storefront` all pass.
- `npm run lint`, `npm run typecheck` → pass.

## Follow-up (scheduled, not built yet)
Real mail (SMTP) and phone (SMS) delivery for contact-verification codes, for
both admin and web users, injected behind the same verifier contract. The
`verify-contact` token flow (delivery.send) already exists; only the actual
mail/sms transport needs to be added and the dev verifier production-gated off.
