# Task: Stage 3 Control-Plane Completion (reporting, approval boundary, real executor, entry evidence)

- Status: Complete
- Owner/agent: autonomous
- Branch: `agent/stage3-completion`
- Risk: Low
- Related epic: Stage 3 control plane
- Related ADRs: 0005 (control plane), 0007 (executor contract), 0008 (Stage 3 entry evidence)


## Objective

Close the four remaining Stage 3 gaps so the control plane is complete for bounded local/CI parallel orchestration: (1) cost/runtime reporting, (2) explicit approval-boundary enforcement in the loop, (3) a real (non-noop) executor demonstration path, and (4) a Stage 3 entry-evidence decision record.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md` (Stage 3 required capabilities + decision-record rule)
- `docs/adr/0005-stage3-control-plane.md` (success metrics: runtime, retry rate, cost)
- `docs/adr/0007-vendor-neutral-executor-contract.md`
- `docs/status/PROJECT_STATUS.md`

## Scope

- Add a `summarizeRuns(records)` reporting function to `scripts/control-plane.mjs` that aggregates total cost units, total runtime, per-task breakdown, retry rate, and pass/fail/blocked counts from durable run records.
- Surface the reporting summary in `scripts/autonomous-loop.mjs` output.
- Add an explicit `approvalBoundary` option to `runParallelWorkers`/`runAutonomousLoop` that enforces which actions require approval via `evaluateAction`'s `approved` flag.
- Add a real (non-noop) executor example and a non-dry-run invocation path that is CI-safe and local-only.
- Record Stage 3 entry evidence as an ADR (`docs/adr/0008-stage3-entry-evidence.md`).
- Add tests for all new behavior.
- Update `docs/status/PROJECT_STATUS.md` and write a handoff.

## Non-scope

- Production deployment, real provider credentials, destructive migrations, customer-data deletion, test/security weakening, core invariant changes (all hard stops).
- Wiring a specific vendor (Cline/DeepSeek) CLI/API — only the vendor-neutral contract is used.
- Any change to the bKash credentials slice already in the working tree.

## Domain invariants affected

- None. All changes are additive, repository-local control-plane tooling. Server-authoritative state, idempotency, and hard-stop enforcement are preserved.

## Acceptance criteria

- [x] `summarizeRuns(records)` returns total cost units, total runtime, per-task breakdown, retry rate, and pass/fail/blocked counts; tested.
- [x] `autonomous-loop.mjs` prints the reporting summary; tested.
- [x] `runParallelWorkers`/`runAutonomousLoop` accept an `approvalBoundary` option and block actions that require approval when not approved; tested.
- [x] A real executor example and non-dry-run invocation path exist and are CI-safe; tested.
- [x] ADR 0008 records Stage 3 entry evidence (trigger, capabilities, cost/owner, rollout/rollback, success metrics, manual controls).
- [x] `npm run verify` passes.


## State/API/schema/UI impact

- No public API, schema, or UI change. Only control-plane tooling and docs.

## Security and privacy review

- Reporting aggregates only allow-listed, secret-free fields already sanitized by the log store.
- Approval boundary uses the existing `evaluateAction` policy; no new authority is granted.
- Real executor path remains local/CI-only and never performs a hard-stop action.
- No secrets, credentials, or production data involved.

## Test plan

- Unit: `summarizeRuns`, approval-boundary enforcement, real-executor path, loop summary output.
- Full gate: `npm run verify`.

## Migration and rollback

- None. No migrations.

## Prohibited changes / hard stops

- No production deployment, real credentials, destructive migration, customer-data deletion, test/security weakening, or core invariant change.
