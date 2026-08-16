# Handoff — bKash credentials admin panel (sandbox/live toggle)

## Task scope

Add an admin panel to store and switch between sandbox and live bKash payment
credentials, encrypted at rest, and wire the payment service to build a real
gateway from the active credentials (falling back to the sandbox gateway when
none are configured). This is the safe, reversible foundation for real payment
integration; it does not touch real provider credentials or production.

## Acceptance criteria

- Admin can save sandbox and live bKash credentials via a new admin UI.
- Credentials are encrypted at rest (AES-256-GCM) and never shown back in
  plaintext; only masked projections are returned over HTTP.
- Admin can activate one mode (sandbox or live); the other is deactivated.
- The payment service builds a bKash gateway from the active credentials and
  derives a server-authoritative provider transaction id; falls back to the
  sandbox gateway when nothing is active.
- All gates pass (`npm run verify`).

## Changed files

- `apps/api/migrations/0021_payment_provider_config.sql` — new table
  `payment_provider_config` (provider, mode, encrypted credentials, active flag).
- `packages/domain/src/payment/payment-provider-config.mjs` — domain record,
  `normalizeCredentials`, `maskCredentials`, `PaymentProvider`, `PaymentProviderMode`.
- `packages/domain/src/index.mjs` — exports the new payment config domain and
  `createBkashGateway`.
- `packages/domain/src/vendor/vendor-adapters.mjs` — added `createBkashGateway`
  (provider-neutral gateway matching the sandbox contract, deterministic and
  idempotent by reference).
- `apps/api/src/modules/payment/credentials-cipher.mjs` — AES-256-GCM cipher
  (iv:authTag:ciphertext), key from `PAYMENT_CREDENTIALS_KEY` with a clearly
  marked dev-only fallback.
- `apps/api/src/modules/payment/postgres-payment-provider-config-repository.mjs` —
  PostgreSQL persistence.
- `apps/api/src/modules/payment/payment-provider-config-service.mjs` —
  SYSTEM_CONFIGURE-gated save/list/activate plus internal `getActiveCredentials`.
- `apps/api/src/modules/payment/payment-provider-config-http.mjs` — admin HTTP
  routes (`GET/PUT .../config`, `POST .../activate`).
- `apps/api/src/modules/commerce/order-payment-service.mjs` — resolves a real
  bKash gateway from active credentials when a `paymentProviderConfigService` is
  injected; provider txn id stays server-authoritative. `resolveGateway` returns
  the resolved provider identity alongside the gateway so the payment record
  stores *which provider* took the money (`bkash`), not the credential mode.
- `apps/api/src/modules/identity/auth-runtime.mjs` — wires the config service
  into the order payment service.
- `apps/api/src/server.mjs` — mounts the admin payment provider routes.
- `apps/admin/lib/payment-api.js` — admin client for the payment provider API.
- `apps/admin/app/payments/page.js` + `workspace.js` — admin UI with sandbox/live
  toggle, credential form, and activate control.
- `apps/api/test/payment-provider-config-service.test.mjs` — service tests.
- `apps/api/test/bkash-gateway.test.mjs` — gateway adapter tests.
- `apps/api/test/order-payment-service.test.mjs` — added coverage that a payment
  records the provider identity (`bkash`) rather than the credential mode for
  both SANDBOX and REAL active credentials, and still falls back to `SANDBOX`
  when nothing is active.

## Tests / results

- `npm test`: 315 pass, 0 fail, 22 skipped (DB integration).
- `npm run verify`: E0 (36 artifacts), lint, typecheck, tests, build, and
  security scan all pass.

## Decisions / ADRs

- No new ADR required; this extends ADR 0006 (server-authoritative provider
  transaction id) and the vendor-neutral adapter contract (ADR 0007).
- Credentials are encrypted at rest with `PAYMENT_CREDENTIALS_KEY`; production
  must set a real key (dev-only fallback is clearly marked and rejected by the
  security scan outside local development).

## Risks / blockers

- Real bKash provider integration (actual HTTP calls) is not implemented; the
  gateway is deterministic and secret-free. Real provider credentials and
  production deployment remain human-approval hard stops.
- The admin UI is a new route (`/payments`) not yet linked from the sidebar.

## Branch / commit

- Branch: `agent/stage3-completion`.
- Latest commit: recorded below at commit time.

## Next dependency-ready work

1. Link the `/payments` admin route from the sidebar.
2. Implement a real bKash HTTP adapter behind the injected gateway contract.
3. Wire the worker into the deployment runtime for the courier webhook outbox.
