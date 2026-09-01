# Handoff: bKash IPN/refund, bulk CSV import, ClamAV gate (2026-09-01)

Completes the last three non-hard-stop "remaining scope" slices in one
continuous session. All committed, pushed, and merged into `origin/main`.

## What shipped

### 1. bKash IPN webhook + refund wiring into returns (E10/E12)
- `POST /api/v1/payments/bkash/ipn` — server-to-server IPN reusing the same
  server-authoritative reconciliation as the redirect callback (gateway
  `execute()`, confirm only on `CONFIRMED`).
- Migration `0046_payments_provider_trx_id.sql` stores the bKash `trxID` on
  `payments` when reconciled, so a refund can reverse the exact transaction.
- `orderPaymentService.getRefundContextByOrder(orderId)` — composition-root-only
  public method returning `{ paymentId, trxId }` (never exposed over HTTP).
- `return-request-service` gained a `refundResolver`; `auth-runtime` wires it to
  refund via bKash when SANDBOX credentials are active AND the payment has a
  completed `trxID`, otherwise sandbox fallback. `settleRefund` remains
  replay-safe and gateway failure never rolls back REFUNDED.

### 2. Bulk CSV import (catalog models + indicative quote ranges)
- `POST /api/v1/admin/catalog/import` (`CATALOG_MANAGE` + `PRICING_MANAGE`,
  CSRF + Origin gated). Parses a `category,brand,name,model_code,low_value,high_value`
  CSV; derives slugs; creates missing categories/brands; skips already-imported
  models by slug (idempotent); records a model-level indicative quote range.
- Admin catalog workspace gains an "Import CSV" tab (file picker + textarea
  form) surfacing created/skipped counts. Headed browser evidence in
  `docs/verify/browser-verify.json`.

### 3. Real ClamAV (clamd) malware gate (E19)
- `clamav-scanner.mjs` — clamd `INSTREAM` client (`unix:/path` or `host:port`),
  plus a fail-closed composite scanner that falls back to the bundled signature
  scanner when the daemon is unreachable.
- Opt-in via `CLAMAV_ENDPOINT` (empty = existing fail-closed signature scanner).
  Optional `clamav` service added to `infra/docker-compose.yml`; `CLAMAV_TIMEOUT_MS`
  documented in `.env.example`.
- The clamd daemon binary itself is operator-provisioned (opt-in); the client,
  wiring, and tests are committed.

## Tests
- `apps/api/test/catalog-import-service.test.mjs`, `catalog-import-http.test.mjs`,
  `clamav-scanner.test.mjs` (mock clamd socket), plus updated order-payment and
  return-request fixtures.
- Full suite: 664 tests, 662 pass, 2 fail (pre-existing shared-DB pollution, not
  from this session). `npm run lint` + `typecheck` + `ui-guard` all pass.

## Remaining (all hard stops — do not start without explicit approval)
1. Real MFA provider (E17).
2. Container scanner (`docker scout`/`trivy`) (E13 backlog item 13).
3. Production deployment + real provider credentials.

## References
- `docs/tasks/REMAINING_SCOPE_BACKLOG.md` (items 3, 11, 12 now COMPLETE).
- `docs/status/PROJECT_STATUS.md` (E10/E19 remaining columns cleared).
