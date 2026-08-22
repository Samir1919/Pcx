# Agent Handoff: Technician inspection execution + health score + grade

- Status: Complete
- Branch: `agent/web-sell-post-price-redirect`
- Latest commit: `5d4f6ab`
- Date: 2026-08-22

## Outcome

A technician can now perform a category-scoped inspection against a physical InventoryItem: start a DRAFT inspection, record per-template-item results, and submit. The server derives a rule-based health score (critical items weight 3×), suggests a condition grade (A_PLUS/A/B/C/REJECT), enforces mandatory tests, escalates critical failures, and on supervisor approve/reject records the verified grade + health score onto the inventory item. Admin inventory gained an "Inspect" modal driving the flow.

## Changed areas

- `packages/domain/src/inspection/inspection-execution.mjs` — inspection/test-result factories, `computeHealthScore`, `suggestGrade`, `submitInspection`, `approveInspection`, `rejectInspection` with immutable finalization rules.
- `packages/domain/src/index.mjs` — exports the new inspection-execution surface.
- `apps/api/migrations/0029_inspection_execution.sql` — `inspections`, `test_results`, `health_scores` tables + `inventory_items.condition_grade/current_health_score/approved_at` columns (additive).
- `apps/api/src/modules/inspection/postgres-inspection-execution-repository.mjs` — repository (create, findActiveByItem, upsertResult, submit, finalize).
- `apps/api/src/modules/inspection/inspection-execution-service.mjs` — service (start/putResult/submit/approve/reject/get/list), RBAC (INSPECTION_SUBMIT / INSPECTION_OVERRIDE), server-owned health/grade.
- `apps/api/src/modules/inspection/inspection-execution-http.mjs` — HTTP handler `/api/v1/inspections` with CSRF/origin writes.
- `apps/api/src/server.mjs`, `apps/api/src/modules/identity/auth-runtime.mjs` — routing + composition wiring.
- `apps/admin/lib/ops-api.js` — inventory inspection API methods.
- `apps/admin/app/(workspace)/inventory/page.js` + `inspection-modal.js` — "Inspect" button and modal (start → results → submit → approve/reject).
- `scripts/live-verify.mjs` — hang-proof real-browser verification safeguard (default 5s timeout, try/finally browser close, graceful PASS/SKIPPED/FAIL).
- Tests: `packages/domain/test/inspection-execution.test.mjs`, `apps/api/test/inspection-execution-service.test.mjs`, `apps/api/test/inspection-execution-http.test.mjs`.

## Acceptance criteria

- [x] Technician completes mandatory inspection and produces verified status via server-owned transitions.
- [x] Health score derived rule-based (critical=3×), grade suggested server-side.
- [x] Mandatory tests enforced on submit; critical failure escalates.
- [x] Supervisor approve/reject records grade + health on the inventory item.
- [x] Admin inventory "Inspect" modal drives the flow.

## Verification

| Command/test | Result |
|---|---|
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run security` | Pass |
| `npm test` | 473 pass, 0 fail, 23 skipped |
| `npm run build` | Pass |
| `node scripts/live-verify.mjs admin-inventory` | PASS |
| `node scripts/live-verify.mjs sell-flow` | PASS |
| `curl` unauth `/api/v1/inspections?inventoryItemId=…` | 401 UNAUTHENTICATED |

## Architecture/security review

- Inspection results immutable after submit: domain `submitInspection` requires DRAFT; `approve/reject` require SUBMITTED; ESCALATED cannot be plain-approved (critical failure must go through reasoned override, not yet implemented).
- Grade/health are never client-input; derived server-side and written onto inventory on finalize.
- RBAC: INSPECTION_SUBMIT for technician, INSPECTION_OVERRIDE for supervisor.
- No invariant regression.

## Schema/configuration/deployment

Additive migration `0029`. Non-destructive. No production deployment.

## Remaining work and next safe action

Next (Slice 2): PCX ID generation + populated passport (grade/health now available). Carry over: evidence upload (inspection_media), reinspection/supersede, reasoned supervisor override for critical-fail.

## Blockers requiring human decision

None for this slice. Real bKash live credentials remain a separate hard stop (payment epic).
