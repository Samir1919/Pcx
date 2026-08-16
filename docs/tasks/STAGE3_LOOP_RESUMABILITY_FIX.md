# Task: Autonomous loop resumability and git cleanup fix

## Context

Running `scripts/autonomous-loop.mjs` repeatedly against the same task graph
kept "getting stuck" — subsequent runs re-attempted the same tasks (no
durable dependency-ready progress across process invocations) and every real
run left behind an `agent/<task>` branch and a `.worktrees/<task>` git
worktree entry, since a merged branch was never deleted. Over time this
accumulated 40+ stale `agent/*` branches in this repository. Additionally, a
worktree-create or merge failure was silently treated as a driver bookkeeping
detail rather than a real task failure, so a real git failure never appeared
in `summary.failed`.

## Root causes fixed

1. **No durable graph write-back.** `runAutonomousLoop`/`main()` never
   persisted completed/failed task status back to the graph file, so a second
   process invocation had no record of prior progress and either re-ran
   already-completed work or produced a `readyTasks` result that looked
   "stuck" relative to a graph that (from the file's perspective) still had
   every task `PENDING`.
2. **No branch cleanup after merge.** `runOneWorker` created an agent branch,
   merged it, and removed the worktree, but never deleted the merged branch,
   so agent branches accumulated indefinitely across runs.
3. **Git failures were not real task failures.** A failed `createWorktree` or
   `mergeWorktree` was not converted into a `FAILED` task record, so the
   pipeline never reported the true failure and the caller had no signal to
   stop retrying that task.

## Scope

- `scripts/control-plane.mjs`:
  - `readyTasks` now treats a task already marked `status: "PASSED"` in the
    graph as completed even if it is not in the `completedIds` set passed in
    (durable resume support).
  - `runOneWorker` now returns a `FAILED` record (with `failureClass`
    `worktree_create_failed` or `merge_failed`) when `createWorktree`/
    `mergeWorktree` fails, while still removing the worktree for cleanup.
  - `createShellGit` gained `deleteBranch`, and `runOneWorker` deletes the
    merged agent branch after a successful merge (best-effort, only when the
    injected git adapter provides `deleteBranch`).
- `scripts/autonomous-loop.mjs`:
  - Added `applyRunSummaryToGraph(graph, summary)` — a pure function that
    returns a plain graph object with `PASSED`/`FAILED` status applied to
    every task touched by a run summary, preserving the status of untouched
    tasks.
  - `main()` persists the updated graph back to `--graph` after every real
    run (`--no-persist-graph` opts out; useful for CI dry-runs against a
    fixture file that must stay pristine).
- Tests added/updated in `scripts/control-plane.test.mjs` and
  `scripts/autonomous-loop.test.mjs` covering: durable `PASSED` resume,
  merge-failure task-failure mapping, worktree-create-failure task-failure
  mapping, branch deletion after merge, and `applyRunSummaryToGraph`.

## Out of scope

- Deleting the 40+ pre-existing stale `agent/*` branches from before this fix
  (a one-time manual/ops cleanup, not a code change; can be done with
  `git branch -D $(git branch --list 'agent/*' | tr -d ' *')` once confirmed
  merged/obsolete).
- Real agent executor wiring (unchanged, still injected).
- Production deployment or real provider credentials (hard stop).

## Acceptance criteria

- A second invocation of the autonomous loop against a graph produced by a
  prior successful run finds no dependency-ready work (all tasks already
  `PASSED`) instead of appearing stuck or re-running completed work.
- A real merge succeeds → agent branch is deleted; the worktree is removed.
- A real merge conflict or worktree-create failure is reported as a `FAILED`
  task, and the worktree is still cleaned up.
- `npm run verify:e0` and `npm test` pass.

## Files

- `scripts/control-plane.mjs`
- `scripts/control-plane.test.mjs`
- `scripts/autonomous-loop.mjs`
- `scripts/autonomous-loop.test.mjs`
- `docs/tasks/STAGE3_LOOP_RESUMABILITY_FIX.md`
- `docs/handoffs/STAGE3_LOOP_RESUMABILITY_FIX.md`
- `docs/status/PROJECT_STATUS.md`
