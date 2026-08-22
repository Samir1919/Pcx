# ADR 0008: Stage 3 entry evidence and control-plane completion

- Status: Accepted
- Date: 2026-08-17

## Context

The autonomy evolution roadmap (`docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`) requires a decision record before adopting a new stage, recording trigger evidence, capabilities introduced, cost/owner, rollout/rollback, success metrics, and controls that remain manual. Stage 3 (coordinated multi-agent control plane) has been implemented incrementally across several bounded slices. This ADR records the entry evidence and confirms the control plane is complete for bounded local/CI parallel orchestration.

## Trigger evidence

The roadmap's Stage 2 exit criteria are met:

- The backlog contains multiple dependency-ready tasks that benefit from parallel execution (spec, api, web slices in the autonomous graph).
- Review/security/QA bottlenecks would delay delivery without a coordinated pipeline.
- Cost, retry, timeout, and artifact tracking require centralized visibility (ADR 0005 success metrics).
- Multiple agent branches and worktrees already exist, and coordination conflicts/merge failures have consumed material time (see `docs/archive/handoffs/STAGE3_WORKTREE_CONFLICT_PLANNING.md`).

## Capabilities introduced

The Stage 3 control plane now provides:

- **Task DAG validation** (`validateTaskGraph`): versioned graph, dependency/ownership metadata, cycle detection, and unsequenced affected-path overlap rejection.
- **Default-deny policy engine** (`evaluateAction`): allow-listed safe actions, hard-stop pattern rejection, and production-environment denial.
- **Bounded local runner** (`runBoundedTask`): retry, timeout, budget, cancellation, kill switch, and artifact metadata.
- **Parallel worktree planner** (`planParallelTasks`): prefix-aware file/module/migration conflict detection and deterministic branch/worktree naming.
- **Worktree orchestration** (`createWorktree`/`removeWorktree`/`mergeWorktree`): isolated branches, merge-conflict abort, cleanup-failure reporting, and merged-branch deletion.
- **Review/QA/security/integrated-verification/handoff adapters**: typed findings, gate results, mandatory security review for sensitive surfaces, and durable secret-free handoffs.
- **Real shell git adapter** (`createShellGit`): execFile (no shell interpolation), validated agent branches and `.worktrees/` paths, and a safe `commit` method that rejects multi-line messages to prevent a shell hang.
- **Durable secret-free log store** (`createFileLogStore`): append-only JSONL with allow-listed fields and secret rejection.
- **Cost/runtime/retry reporting** (`summarizeRuns`): aggregates task count, cost units, runtime span, retry rate, status counts, and batch ids.
- **Approval boundary** (`approvalBoundary`): blocks unapproved commit-creating actions with `approval_required`.
- **Vendor-neutral executor contract** (ADR 0007) with `validateExecutorResult` and a real (non-noop) executor (`createRealExecutor`) that writes a verifiable marker artifact.
- **Autonomous loop driver** (`scripts/autonomous-loop.mjs`): loads a bounded task graph, runs every dependency-ready task through the full pipeline, persists completed/failed status back to the graph for cross-process resume, and reports a durable summary.

## Cost and maintenance owner

- Owner: repository maintainers (human) with autonomous agents as contributors.
- Cost: the control-plane tooling (`scripts/control-plane.mjs`, `scripts/autonomous-loop.mjs`) and their tests must be maintained alongside the application. The tooling is repository-native and has no external runtime dependency.

## Rollout and rollback

- Rollout: the control plane was introduced in bounded slices, each passing deterministic tests and `npm run verify` before the next was enabled (ADR 0005 rollout plan).
- Rollback: disable the runner and return to the existing manual workflow if policy evaluation, artifact recording, isolation, or verification becomes unreliable. No business data migration is required.

## Success metrics

- 100% of automated task runs have a task ID, scope, owner, policy result, artifacts, verification result, and handoff.
- 0 production/hard-stop actions performed by the runner.
- 0 overlapping migration writers admitted concurrently.
- Bounded retry/timeout/budget violations are rejected deterministically.
- Integrated verification is required before a candidate is reported ready.
- Merge conflict rate, duplicated-task rate, runtime, retry rate, and cost are measured before expanding parallelism.

## Controls that remain manual

Production deployment, production credentials/secrets, payment destinations, destructive migrations, customer-data deletion, core invariant/source-of-truth changes, and material security-policy changes remain human approval gates under `AGENTS.md`. The approval boundary is an additional human-gated control layered on top of the existing default-deny policy and hard-stop enforcement; it never weakens them.

## Approval

Accepted for bounded local/CI implementation by the human instruction to proceed and continue. Acceptance authorizes the Stage 3 control-plane completion as recorded here, but does not authorize production deployment, wiring a specific vendor executor, or any existing hard stop.
