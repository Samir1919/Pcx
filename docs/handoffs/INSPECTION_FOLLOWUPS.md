# Agent Handoff: E5 inspection follow-ups (supersede + override)

- Status: Complete
- Branch: main
- Latest commit: (filled after commit)
- Date: 2026-09-01

## Outcome

Two inspection follow-ups are now enforced server-side and surfaced in the admin
"Inspect" modal:

- **Reinspection/supersede** — starting a new inspection for an item that already
  has a SUBMITTED/ESCALATED inspection supersedes the prior one (SUPERSEDED,
  history preserved) instead of blocking. A DRAFT still blocks with
  `already_in_progress`.
- **Reasoned supervisor override (critical-fail)** — an ESCALATED (critical-failure)
  inspection can no longer be cleared by a plain approve; it requires a separate
  override with a chosen grade and a non-empty reason, audited as
  `INSPECTION_OVERRIDDEN`.

## Changed areas

- `packages/domain/src/inspection/inspection-execution.mjs` — `overrideInspection`,
  `supersedeInspection`, grade validation set.
- `packages/domain/src/index.mjs` — exports.
- `apps/api/src/modules/inspection/postgres-inspection-execution-repository.mjs` —
  `supersede`, and `finalize` now records the override reason in `notes`.
- `apps/api/src/modules/inspection/inspection-execution-service.mjs` — `override`
  (INSPECTION_OVERRIDE + reason/grade + audit), `start` supersedes a finalized
  inspection.
- `apps/api/src/modules/inspection/inspection-execution-http.mjs` — `POST
  /api/v1/inspections/:id/override`.
- `apps/admin/lib/ops-api.js`, `apps/admin/app/(workspace)/inventory/inspection-modal.js`
  — ESCALATED override form (grade + reason); SUBMITTED keeps approve/reject.
- Integration tests: added `item_costs` cleanup before `inventory_items` deletes
  (7 tests) so the new FK does not break cleanup.

## Acceptance criteria

- [x] Submitted inspection history preserved (SUPERSEDED, never overwritten).
- [x] Critical overrides are privileged (INSPECTION_OVERRIDE), reasoned (required
  reason), and audited (INSPECTION_OVERRIDDEN).

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/inspection-execution.test.mjs` | pass (incl. override/supersede) |
| `node --test apps/api/test/inspection-execution-service.test.mjs` | 7/7 pass |
| `npm test` (unit) | 0 fail |
| `npm run lint` / `typecheck` | pass |

Note: two integration tests (`sell-request-repository`, `sell-taxonomy-repository`)
fail against the shared local `pcx` DB from prior-run pollution (notifications FK +
`psu.required`) — pre-existing. `npm run build` fails locally under Node v26.4.0
(`/_global-error` prerender) — pre-existing.

## Architecture/security review

- Enforces the standing invariant "critical inspection overrides are privileged,
  reasoned, and audited."
- Override is gated by `INSPECTION_OVERRIDE`; the reason is required and persisted;
  the chosen grade is validated against `ConditionGrade`.

## Schema/configuration/deployment

- None (no migration; uses the existing `inspections.notes` column).

## Remaining work and next safe action

- E7/E8 passport & storefront (listing QR, verification summary, search index).
- E9 order/payment allocation (server-derived shipping/tax).

## Blockers requiring human decision

- None.
