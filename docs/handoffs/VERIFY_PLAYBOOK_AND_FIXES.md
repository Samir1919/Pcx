# Handoff: Full-Stack Human-Like Verification (A→Z) + Fixes

- Branch: `main`
- Commit: `18ebd08`
- Related playbook: `docs/verify/FULLSTACK_VERIFICATION_PLAYBOOK.md` (new, permanent)

## Objective and completed scope

Verify the whole platform (backend + admin + web) like a human, fix every
mismatch found, and codify a reusable A→Z verification playbook.

Completed:
1. Added `docs/verify/FULLSTACK_VERIFICATION_PLAYBOOK.md`, an `AGENTS.md`
   pointer, and an `e0-check` gate entry so future "verify like a human" runs
   follow one durable procedure.
2. Fixed order-payment RESERVED→SOLD: `createOrderWithItems` now snapshots the
   server-claimed listing id (not the client `listingId`) so `confirmPayment`
   marks the listing SOLD even when the client sends no listing id.
3. Fixed the migrations integration test to expect `0036_inventory_acquisition_cost.sql`.
4. Fixed `admin-e2e` (acquisition-detail mutually-exclusive forms; inventory
   template autoselect now targets a templated category and waits).
5. Fixed `business-e2e` (admin surface header + csrf in `pageFetchJson`; added
   the inspection→approve step; drove the dialog-based ship/deliver flow).
6. Seed: added `demo-technician` and `demo-supervisor`, granted `demo-admin`
   SUPERVISOR, and documented the accounts in README.

## Verification results (all green)

- `npm run verify`: PASS (verify:e0 37 artifacts; test 588/561/0 fail/27 skip;
  lint/typecheck/build/security/ui-guard all pass)
- `npm run test:integration` (TEST_DATABASE_URL against a fresh `pcx_test`): 27/27
- `npm run web:check`: 6/6 pages
- `storefront-e2e`: 15/15
- `admin-e2e`: 27/27
- `business-e2e`: 12/12 (Sell-to-PCX + Buy/fulfilment end-to-end)
- `merge-gate`: OK (merged into `origin/main`)

## Findings (recorded)

- Seed gap: inspection templates exist only for Desktop PC and GPU categories.
- Seed gap: no technician/supervisor demo accounts existed (now added).
- The APPROVED listing gate (commit `30d79ca`) had broken the `business-e2e`
  self-provisioning flow (no inspection step) — fixed in the harness.
- The RESERVED→SOLD feature (commit `6d2a741`) was broken in the listingId-null
  path — fixed in the repository.

## Security and architecture notes

- No production changes and no real credentials. Demo accounts are dev-only.
- RBAC verified: a plain ADMIN receives `403 INSPECTION_FORBIDDEN`; a supervisor
  can submit and approve an inspection.

## Unresolved findings / blockers

None.
