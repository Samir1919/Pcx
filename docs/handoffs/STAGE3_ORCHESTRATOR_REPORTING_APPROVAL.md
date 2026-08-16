# Agent Handoff: Stage 3 Orchestrator Reporting, Approval Boundary, and Real Executor

- Status: Complete
- Branch: `agent/stage3-orchestrator-reporting`
- Latest commit: (pending commit)
- Date: 2026-08-17

## Outcome

The autonomous orchestration loop now reports cost/runtime/retry metrics per
run, enforces an explicit approval boundary before any commit-creating action,
and demonstrates a real (non-noop) vendor-neutral executor that writes a
verifiable artifact. The loop summary surfaces the run report, and the CLI
gains `--real-executor` and `--approval-required` flags.

## Changed areas

- `scripts/control-plane.mjs`
  - Added `summarizeRuns` to aggregate task count, cost units, runtime span,
    retry rate, status counts, and batch ids from run records (raw worker
    records or sanitized log entries).
  - Added `approvalBoundary` option to `runBoundedTask` and `runParallelWorkers`
    so actions listed in `requiresApproval` are blocked unless present in
    `approved`. Blocked tasks are recorded with `failureClass: approval_required`.
- `scripts/autonomous-loop.mjs`
  - Added `createRealExecutor` factory that writes a task-scoped marker file
    under `.worktrees/executor-output/` and returns a real artifact path.
  - `runAutonomousLoop` now computes and returns a `report` via `summarizeRuns`.
  - `writeSummary` surfaces the run report.
  - Added `--real-executor` and `--approval-required` CLI flags.
- `scripts/control-plane.test.mjs` — tests for `summarizeRuns` and the approval boundary.
- `scripts/autonomous-loop.test.mjs` — tests for `createRealExecutor` and the loop report.
- `docs/tasks/STAGE3_ORCHESTRATOR_REPORTING_APPROVAL.md` — bounded task spec.

## Acceptance criteria

- [x] `summarizeRuns` aggregates cost, runtime, retry rate, and status counts and is tested.
- [x] `approvalBoundary` blocks unapproved commit-creating actions and is tested.
- [x] `createRealExecutor` writes a verifiable marker file and is tested.
- [x] The loop summary surfaces the run report.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs scripts/autonomous-loop.test.mjs` | 60 pass, 0 fail |
| `npm run verify:e0` | E0 verified: 36 required artifacts |
| `npm test` | 302 pass, 22 skipped, 0 fail |
| `npm run lint` | Lint policy check passed |
| `npm run typecheck` | Domain contract check passed |
| `node scripts/autonomous-loop.mjs --dry-run --real-executor --no-persist-graph` | Completed spec/api/web; report surfaced (Tasks 3, Passed 3, Cost 3) |
| `node scripts/autonomous-loop.mjs --dry-run --approval-required --no-persist-graph` | spec blocked (approval_required); api/web blocked as dependents |

## Architecture/security review

- The approval boundary is an additional human-gated control layered on top of
  the existing default-deny policy and hard-stop enforcement (ADR 0005, 0007).
  It never weakens them.
- `summarizeRuns` only sums allow-listed numeric/status fields and is secret-free.
- `createRealExecutor` only emits allow-listed artifacts under `.worktrees/` and
  rejects traversal output directories.
- No invariants changed; no production, credential, migration, or data changes.

## Schema/configuration/deployment

- None. No migrations, environment variables, or deployment changes.

## Remaining work and next safe action

- Wire a specific vendor executor (Cline/DeepSeek) behind the vendor-neutral
  contract (ADR 0007) once a real agent executor is available.
- Consider persisting the run report to the durable log store for cross-run
  cost/retry trend analysis.

## Blockers requiring human decision

- None.
