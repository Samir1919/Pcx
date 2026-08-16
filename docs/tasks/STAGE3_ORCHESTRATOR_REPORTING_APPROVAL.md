# Task: Stage 3 Orchestrator Reporting, Approval Boundary, and Real Executor

- Status: Complete
- Owner/agent: autonomous
- Branch: `agent/stage3-orchestrator-reporting`
- Risk: Low
- Related epic: Stage 3 control plane
- Related ADRs: 0005 (control plane), 0007 (vendor-neutral executor contract)

## Objective

Extend the autonomous orchestration loop so it (1) reports cost/runtime/retry
metrics per run, (2) enforces an explicit approval boundary before any
commit-creating action, and (3) demonstrates a real (non-noop) vendor-neutral
executor that writes a verifiable artifact.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/adr/0007-vendor-neutral-executor-contract.md`
- `docs/status/PROJECT_STATUS.md`

## Scope

- Add `summarizeRuns` to `scripts/control-plane.mjs` to aggregate task count,
  cost units, runtime span, retry rate, status counts, and batch ids from run
  records (raw worker records or sanitized log entries).
- Add an `approvalBoundary` option to `runBoundedTask` and `runParallelWorkers`
  so actions listed in `requiresApproval` are blocked unless present in
  `approved`. Blocked tasks are recorded with `failureClass: approval_required`.
- Add `createRealExecutor` to `scripts/autonomous-loop.mjs` as a real,
  verifiable executor that writes a task-scoped marker file under
  `.worktrees/executor-output/` and returns a real artifact path.
- Surface the run report in the loop summary and CLI output.
- Add `--real-executor` and `--approval-required` CLI flags.

## Non-scope

- Wiring a specific vendor (Cline/DeepSeek) CLI/API — only the vendor-neutral
  contract is demonstrated.
- Production deployment, real credentials, destructive migrations, customer-data
  deletion, test/security weakening, or core invariant changes (all hard stops).

## Domain invariants affected

- None. Default-deny policy and hard-stop enforcement are preserved; the
  approval boundary is an additional gate, not a relaxation.
- Executor output remains secret-free and repository-relative (ADR 0007).

## Acceptance criteria

- [ ] `summarizeRuns` aggregates cost, runtime, retry rate, and status counts and is tested.
- [ ] `approvalBoundary` blocks unapproved commit-creating actions and is tested.
- [ ] `createRealExecutor` writes a verifiable marker file and is tested.
- [ ] The loop summary surfaces the run report.
- [ ] `npm run verify` passes.

## State/API/schema/UI impact

- No public API, schema, or UI change. CLI gains two optional flags.

## Security and privacy review

- The approval boundary is an explicit human-gated control; it never weakens
  default-deny or hard stops.
- The report only sums allow-listed numeric/status fields; it is secret-free.
- The real executor only emits allow-listed artifacts under `.worktrees/`.

## Test plan

- Unit: `summarizeRuns`, approval boundary in `runBoundedTask`/`runParallelWorkers`,
  `createRealExecutor`.
- Full gate: `npm run verify`.

## Migration and rollback

- None.

## Prohibited changes / hard stops

- No production deployment, real credentials, destructive migration, customer-data
  deletion, test/security weakening, or core invariant change.
