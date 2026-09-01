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

- Scope: injected sandbox refund gateway behind the existing settleRefund flow
  (domain `settleRefund`, repository, HTTP already complete); idempotent provider
  transaction id; gateway failure never rolls back the REFUNDED transition.
- Acceptance: settleRefund calls the gateway; replay-safe; sandbox-only.

## 3. Real bKash HTTP adapter (E10)

- Scope: real bKash HTTP adapter behind the injected gateway contract (sandbox
  credentials only until human approval); webhook handling; refunds + reconciliation.
- Hard stop: real provider credentials and live mode need human approval.

## 4. E5 inspection follow-ups

- Scope: reinspection/supersede of a submitted inspection; reasoned supervisor
  override of a critical-fail (privileged + audited); technician autosave/draft.
- Invariants: submitted inspection history preserved; critical overrides reasoned + audited.

## 5. E7/E8 passport & storefront

- Scope: listing QR (stable passport URL), verification summary on passport,
  dedicated search index/recommendation.

## 6. E9 order/payment allocation

- Scope: server-derived shipping/tax allocation on orders; rendered read-only
  on admin + customer surfaces (no UI re-derivation).

## 7. E11 fulfilment

- Scope: packaging evidence media (link table + upload UI), return-to-origin shipment flow.

## 8. E13 warranty

- Scope: warranty policy authoring (replace manual `policySnapshot: {}`),
  claim inspections, carrier pickup, cost accounting.

## 9. E14/E16 reporting & audit

- Scope: full BI/reporting UI, scheduled exports, external SIEM.

## 10. E17 security

- Scope: upload scanning, HSTS, CSP allowlisting for admin UI, MFA gates.

## 11. E19 media

- Scope: S3/MinIO storage adapter swap (currently local `MEDIA_ROOT`), malware scan integration.

## 12. Bulk CSV import

- Scope: catalog models/attributes and indicative quote ranges; parser + mapping + idempotent batch insert.

## 13. Container scanner

- Scope: install/authenticate a real container scanner (docker scout login or trivy) to produce an actual image vulnerability report.

## 14. Production deployment + real provider credentials

- Hard stop: requires explicit human approval (production deploy, real payment/courier/notification provider credentials).
