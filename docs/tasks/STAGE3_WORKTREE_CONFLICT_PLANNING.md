# Task: Stage 3 Worktree and Conflict Planning

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Medium
- Related epic: E0 / E16
- Related ADRs: ADR 0005 (accepted)

## Objective

Plan isolated branches/worktrees for dependency-ready tasks while detecting transitive ordering and file, module, and migration conflicts before any parallel worker adapter is enabled.

## Scope

- Make overlap validation dependency-transitive and prefix-aware.
- Detect file, module, and migration writer conflicts.
- Produce deterministic, repository-relative branch/worktree plans for non-conflicting ready tasks.
- Defer conflicting ready tasks with explicit conflict evidence.
- Add deterministic tests.

## Non-scope

- Creating worktrees, invoking workers, shell execution, merging, deployment, or credentials.

## Acceptance criteria

- [x] Transitively ordered tasks may share affected paths; unordered shared/prefix paths are rejected.
- [x] Module and migration conflicts are reported deterministically.
- [x] Planner selects only dependency-ready non-conflicting tasks.
- [x] Planned worktree paths are repository-relative and task IDs are safely slugged.
- [x] `npm run verify` passes.

## Security and privacy review

No command execution. Paths must remain relative and cannot contain traversal. Existing default-deny policy and hard stops are unchanged.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove planner exports to return to bounded runner only.
