# Task: Stage 3 Worktree Orchestration and Parallel Worker Driver

- Status: Complete
- Owner/agent: Cline
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Medium
- Related epic: E0 / E16
- Related ADRs: ADR 0005 (accepted)

## Objective

Enable the parallel worker adapters by adding isolated worktree creation/removal, merge orchestration, and a parallel worker driver loop that runs each dependency-ready, non-conflicting task through the full review/QA/security/verification/handoff pipeline.

## Scope

- Add `createWorktree`, `removeWorktree`, and `mergeWorktree` orchestration primitives that delegate to injected git operations (deterministic, no shell execution in core logic).
- Validate worktree plans: agent branches only, repository-relative `.worktrees/` paths, no traversal.
- Add `runParallelWorkers` driver loop that:
  - selects dependency-ready, non-conflicting tasks via `readyTasks` + `planParallelTasks`;
  - runs each task through `runBoundedTask`, `runQaGates`, `securityReview`, `reviewTask`, `verifyIntegrated`, and `buildHandoff`;
  - defers conflicting ready tasks and runs them sequentially;
  - records failed tasks and never re-attempts them (loop always terminates);
  - optionally creates/merges/removes worktrees when git is provided.
- Add deterministic tests.

## Non-scope

- Real shell/vendor adapters, durable log persistence, production deployment, credentials, or any hard-stop action.

## Acceptance criteria

- [x] Worktree plans require `agent/` branches and `.worktrees/` repository-relative paths.
- [x] `createWorktree`/`removeWorktree`/`mergeWorktree` delegate to injected git and report conflicts deterministically.
- [x] `runParallelWorkers` runs dependency-ready tasks and produces secret-free handoffs.
- [x] Conflicting ready tasks are deferred and run sequentially.
- [x] Failed tasks are recorded and the loop terminates.
- [x] `npm run verify` passes.

## Security and privacy review

No command execution in core logic; git operations are injected. Paths remain repository-relative and reject traversal. Default-deny policy and hard stops are unchanged. No commerce-domain invariant, API, schema, or production policy changed.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove the new exports to return to adapter-only behavior.
