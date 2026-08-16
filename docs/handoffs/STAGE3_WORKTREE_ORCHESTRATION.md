# Agent Handoff: Stage 3 Worktree Orchestration and Parallel Worker Driver

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: (fill after merge)
- Date: 2026-08-16

## Outcome

The Stage 3 control plane (`scripts/control-plane.mjs`) now enables the parallel worker adapters. It exposes `createWorktree`, `removeWorktree`, and `mergeWorktree` orchestration primitives that delegate to injected git operations, and a `runParallelWorkers` driver loop that runs each dependency-ready, non-conflicting task through the full review/QA/security/verification/handoff pipeline. Conflicting ready tasks are deferred and run sequentially; failed tasks are recorded and never re-attempted, so the loop always terminates. When git is provided, the driver creates an isolated worktree, merges the completed branch into the integration candidate, and removes the worktree.

## Changed areas

- `scripts/control-plane.mjs` — added `asWorktreePlan` (agent-branch + `.worktrees/` repository-relative validation), `requireGit`, `createWorktree`, `removeWorktree`, `mergeWorktree`, `runWorkerPipeline`, `runOneWorker`, and `runParallelWorkers`. All git operations are injected; no shell command is executed in core logic.
- `scripts/control-plane.test.mjs` — added deterministic tests for worktree plan validation, create/remove/merge delegation, conflict reporting, parallel driver execution with handoffs, sequential deferral of conflicting tasks, failed-task recording with loop termination, and worktree create/merge/remove when git is provided.
- `docs/tasks/STAGE3_WORKTREE_ORCHESTRATION.md` — completed bounded task record.
- `docs/status/PROJECT_STATUS.md` — updated Stage 3 evidence, verification baseline, latest evidence link, and next dependency-ready work.

## Acceptance criteria

- [x] Worktree plans require `agent/` branches and `.worktrees/` repository-relative paths.
- [x] `createWorktree`/`removeWorktree`/`mergeWorktree` delegate to injected git and report conflicts deterministically.
- [x] `runParallelWorkers` runs dependency-ready tasks and produces secret-free handoffs.
- [x] Conflicting ready tasks are deferred and run sequentially.
- [x] Failed tasks are recorded and the loop terminates.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs` | Pass: 22/22 |
| `npm run verify` | Pass: 235 tests (213 pass, 22 PostgreSQL skips by design, 0 failed), build pass, security scan pass |
| `git diff --check` | Pass |

## Architecture/security review

- Orchestration primitives are pure and side-effect-injected, keeping them deterministic and testable.
- Worktree plans are restricted to `agent/` branches and `.worktrees/` repository-relative paths; traversal and absolute paths are rejected.
- The driver cannot broaden repository authority or bypass hard stops; merge is not a production deployment and remains governed by existing policy.
- No commerce-domain invariant changes. ADR 0005 (accepted) governs the Stage 3 control plane.

## Schema/configuration/deployment

None. Repository-local tooling only; no business API, schema, or UI changes. Rollback: remove the new exports to return to adapter-only behavior.

## Remaining work and next safe action

1. Add real shell/vendor adapters and durable action/artifact log persistence for the driver.
2. Complete safe Stage 2 release slices: container image scan when an image exists, plus sandbox payment/courier/notification adapters.
3. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None. Production deployment, real provider credentials, destructive migrations, production/customer data actions, and core security/invariant changes remain hard stops.
