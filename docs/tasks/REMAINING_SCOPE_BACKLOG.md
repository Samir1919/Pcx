# Task Backlog: Remaining Scope (Re-verified 2026-09-01)

- Status: Rescheduled backlog — none of these slices are started.
- Related: `docs/status/PROJECT_STATUS.md` (epic table, "Remaining critical scope").
- Source of truth: `docs/specifications/` (BUSINESS_PRODUCT_REQUIREMENTS, DATABASE_ERD, API_SPECIFICATION_STATE_MACHINES, USER_FLOW_SCREEN_MAP).

This file captures the rescheduled remaining work after re-verifying every epic's
"Remaining critical scope" against the codebase. Items confirmed complete were
moved into verified scope in `PROJECT_STATUS.md`; the items below are the true
remaining gaps, ordered by dependency.

---

## 1. item_costs cost allocation (E4/E6)

- Status: **COMPLETE (2026-09-01)** — ADR 0014. `item_costs` append-only ledger
  (`ACQUISITION/REFURBISHMENT/TESTING/PACKAGING/SHIPPING_IN/OTHER`), repository/
  service/HTTP (`GET`/`POST /api/v1/admin/inventory/:id/costs`), admin multi-field
  cost-entry form, and server-derived totals (acquisition seed + SUM) surfaced in
  inventory detail + operations report. Handoff: `docs/handoffs/ITEM_COST_ALLOCATION.md`.

## 2. Refund gateway adapter execution (E12, sandbox)

- Status: **COMPLETE (2026-09-01)** — `createSandboxRefundGateway` domain adapter (idempotent
  by reference, secret-free) wired behind `settleRefund`; migration
  `0038_return_refund_provider.sql` adds `refund_provider`,
  `refund_provider_transaction_id` (unique), and `refund_provider_status` to
  `return_requests`. settleRefund is replay-safe (an already-REFUNDED return is
  returned without a second gateway call) and a gateway failure still transitions
  to REFUNDED, recording `refund_provider_status='FAILED'` for reconciliation.
  Admin returns table surfaces the provider status + transaction id read-only.
  Handoff: `docs/handoffs/REFUND_GATEWAY_ADAPTER.md`.

## 3. Real bKash HTTP adapter (E10)

- Status: **COMPLETE (2026-09-01)** — sandbox-only `bkash-http-adapter.mjs` (grant
  token / create payment "0011" / execute / query / refund, researched from
  developer.bka.sh) + `bkash-http-gateway.mjs` wired into `order-payment-service`
  `resolveGateway`; LIVE mode fails closed (hard stop). Admin payments workspace
  surfaces the sandbox endpoint. Handoff: `docs/handoffs/BKASH_HTTP_ADAPTER.md`.
- Remaining follow-up: webhook/IPN handling and bKash refund wiring into the
  returns module. (Redirect callback + execute/query reconciliation is done —
  `GET /api/v1/payments/bkash/callback?paymentID=…` reconciles server-side via
  the gateway `execute()` and confirms only on CONFIRMED.)

## 4. E5 inspection follow-ups

- Status: **COMPLETE (2026-09-01)** — reinspection/supersede (a new inspection
  supersedes SUBMITTED/ESCALATED, history preserved) and reasoned, audited
  supervisor override of a critical-fail (ESCALATED → APPROVED requires a grade +
  reason, `POST /api/v1/inspections/:id/override`, audit `INSPECTION_OVERRIDDEN`).
  Technician autosave/draft was already satisfied by the incremental result upsert.
  Handoff: `docs/handoffs/INSPECTION_FOLLOWUPS.md`.

## 5. E7/E8 passport & storefront

- Status: **COMPLETE (2026-09-01)** — verification summary (server-derived
  grade + health narrative), listing QR (scan-to-open stable passport URL),
  dedicated Postgres full-text search index (weighted `search_vector` tsvector +
  GIN index, `websearch_to_tsquery` + `ts_rank` relevance ranking, rank-aware
  cursor; migration 0044), and related-listing recommendations (same category,
  same brand first, excluding self; `GET /api/v1/passport/:pcxId/related` +
  "You may also like" on the passport page).

## 6. E9 order/payment allocation

- Status: **COMPLETE (2026-09-01)** — server-derived shipping/tax on orders
  (`deriveOrderAllocation`: flat shipping free above ৳5000 + 5% VAT, migration
  `0039_orders_tax.sql` incl. `orders_check` totals-invariant update), rendered
  read-only in the customer order breakdown (subtotal/shipping/tax/total).
  Handoff: `docs/handoffs/ORDER_TAX_ALLOCATION.md`.

## 7. E11 fulfilment

- Status: **COMPLETE (2026-09-01)** — packaging evidence media (`shipment_media`
  link table + `POST/GET /api/v1/admin/shipments/:id/media`, PRIVATE, admin-gated
  upload + admin Photos modal) and return-to-origin admin action (`POST
  /api/v1/admin/shipments/:id/return`, SHIPPED→RETURNED). Handoff:
  `docs/handoffs/E11_FULFILMENT.md`.

## 8. E13 warranty

- Status: **COMPLETE (2026-09-01)** — warranty policy authoring (`warranty_policies` +
  CRUD + archive), claim inspections (`claims.inspection_id`,
  `linkClaimInspection`, `POST /api/v1/admin/claims/:id/inspection`), and carrier
  pickup (`claims.shipment_id`, `linkClaimShipment`, `POST
  /api/v1/admin/claims/:id/shipment`). `createWarranty` now references an authored
  policy (`policyId`) and the server derives the snapshot + expiry via
  `createWarrantyFromPolicy` (server-owned, client never supplies
  `policySnapshot`/`endsAt`). Cost accounting already exists via
  `claim_resolutions.cost_amount`. Handoff: `docs/handoffs/E13_WARRANTY_POLICY.md`.

## 9. E14/E16 reporting & audit

- Status: **COMPLETE (2026-09-01)** — BI dashboard (`GET /api/v1/admin/reports/bi`:
  revenue by status + inventory value by grade, all server-derived), CSV export
  (`GET /api/v1/admin/reports/operations/export?format=csv`), external-SIEM NDJSON
  export (`GET /api/v1/admin/audit-logs/export?format=ndjson`), and scheduled
  exports (`scheduled_exports` registry, migration 0045, with admin list/create +
  a worker `runDue` job). Admin Reports workspace (`/reports`) surfaces the KPIs,
  download buttons, and the scheduled-export list.

## 10. E17 security

- Status: **PARTIAL (2026-09-01)** — HSTS + `permissions-policy` on the API,
  CSP allow-listing (plus HSTS/nosniff/DENY/referrer) on the admin + storefront
  Next.js apps, and **upload malware scanning** (pluggable scanner interface +
  fail-closed signature scanner: EICAR test signature, executable magic bytes,
  embedded PHP/script/shell payloads; wired into the media upload path as
  `MALWARE_DETECTED` 422) are done. Remaining: MFA gates (real MFA provider is a
  hard stop).

## 11. E19 media

- Status: **PARTIAL (2026-09-01)** — S3/MinIO object-storage adapter
  (`s3-media-storage.mjs`, `minio` client, env-driven via `OBJECT_STORAGE_*`,
  local-disk fallback) is done; uploads now persist to the `pcx-local` MinIO
  bucket. Remaining: a real malware gate (ClamAV) at the object-storage level —
  the E17 fail-closed signature scanner is the current baseline.

## 12. Bulk CSV import

- Scope: catalog models/attributes and indicative quote ranges; parser + mapping + idempotent batch insert.

## 13. Container scanner

- Scope: install/authenticate a real container scanner (docker scout login or trivy) to produce an actual image vulnerability report.

## 14. Production deployment + real provider credentials

- Hard stop: requires explicit human approval (production deploy, real payment/courier/notification provider credentials).
