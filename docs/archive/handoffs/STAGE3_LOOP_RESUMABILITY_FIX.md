# Handoff: Autonomous loop resumability and git cleanup fix

## Task scope

Diagnose and fix why `scripts/autonomous-loop.mjs` appeared to get "stuck"
across repeated invocations, and why real runs accumulated stale `agent/*`
git branches. See `docs/tasks/STAGE3_LOOP_RESUMABILITY_FIX.md` for the full
task specification and root-cause analysis.

## Acceptance criteria (all met)

- A second invocation of the loop against a graph produced by a prior
  successful run finds no dependency-ready work (all tasks already `PASSED`)
  instead of re-running completed work or looking stuck. ✅
  (`readyTasks` durable-`PASSED` test; `applyRunSummaryToGraph` +
  `main()` persistence.)
- A real merge succeeds → the merged agent branch is deleted and the
  worktree is removed. ✅ (`createShellGit.deleteBranch` +
  `runOneWorker` branch-delete-after-merge test.)
- A real merge conflict or worktree-create failure is reported as a `FAILED`
  task, and the worktree is still cleaned up. ✅ (two new
  `runParallelWorkers` tests for `merge_failed` / `worktree_create_failed`.)
- `npm run verify:e0` and `npm test` pass. ✅

## Changed files

- `scripts/control-plane.mjs`
  - `readyTasks`: a task graph entry with `status: "PASSED"` is now always
    treated as completed, regardless of whether its id is present in the
    `completedIds` argument, enabling cross-process resume.
  - `runOneWorker`: a failed `createWorktree` now returns a `FAILED` record
    (`failureClass: "worktree_create_failed"`) instead of throwing/blocking
    silently; a failed `mergeWorktree` now returns a `FAILED` record
    (`failureClass: "merge_failed"`) and still removes the worktree.
  - `createShellGit`: added `deleteBranch({ branch })` (validated agent
    branch, `git branch -D <branch>`, execFile, no shell interpolation).
  - `runOneWorker`: after a successful merge, calls `git.deleteBranch` when
    the injected adapter provides it (best-effort; ignored if absent, so
    existing callers that don't implement `deleteBranch` are unaffected).
- `scripts/autonomous-loop.mjs`
  - Added `applyRunSummaryToGraph(graph, summary)`: pure function mapping a
    run summary onto a validated graph's task statuses (`PASSED`/`FAILED`),
    preserving untouched tasks' existing status.
  - `main()`: persists the updated graph back to `--graph` after every run
    unless `--no-persist-graph` is passed.
- `scripts/control-plane.test.mjs`: added tests for merge-failure and
  worktree-create-failure task mapping, and branch deletion after merge.
- `scripts/autonomous-loop.test.mjs`: added tests for
  `applyRunSummaryToGraph` (marks completed/failed, preserves untouched).
- `docs/tasks/STAGE3_LOOP_RESUMABILITY_FIX.md` (new)
- `docs/handoffs/STAGE3_LOOP_RESUMABILITY_FIX.md` (this file)
- `docs/status/PROJECT_STATUS.md` (updated)

## Tests / results

- `node --test scripts/control-plane.test.mjs scripts/autonomous-loop.mjs`:
  40/40 pass.
- `npm run verify:e0`: 36 required artifacts verified.
- `npm test` (root): 276 total, 254 pass, 22 PostgreSQL-integration tests
  skipped by design (no `TEST_DATABASE_URL`), 0 failed.

## Decisions / ADRs

- No new ADR required; this is a bug fix within the already-accepted ADR
  0005 Stage 3 control-plane design. `deleteBranch` follows the same
  execFile/no-shell-interpolation/validated-branch pattern as the existing
  shell git adapter methods.

## Risks / follow-ups

- The repository currently has ~40 pre-existing stale `agent/*` branches
  from before this fix, left over from earlier bounded-task-runner
  experiments. These are safe to delete once confirmed merged/obsolete but
  were **not** deleted by this change (explicitly out of scope — a one-time
  ops cleanup, not a code change). Suggested command once verified safe:
  `git branch -D $(git branch --list 'agent/*' | tr -d ' *')`.
  A stray `.worktrees/autonomous-loop.log` and `work/autonomous-graph.json`
  fixture were also found untracked in the working tree from a prior manual
  dry-run; they are harmless (log-store output / sample graph) and were left
  as-is since they are not part of this fix's scope, but should be reviewed
  before commit (`work/` may need a `.gitignore` entry if it is meant to stay
  local-only).
- `deleteBranch` in `runOneWorker` is best-effort: if the injected git
  adapter does not implement it (e.g. an older test double), no branch
  deletion is attempted and no error is raised, preserving backward
  compatibility with existing callers/tests.

## Blockers

- None. No hard stop was touched (no production deployment, no destructive
  migration, no payment/secret changes).

## Branch / commit

- Branch: current working branch (see `git status`/`git log` at merge time).
- Latest commit: to be filled by the commit created alongside this handoff.
