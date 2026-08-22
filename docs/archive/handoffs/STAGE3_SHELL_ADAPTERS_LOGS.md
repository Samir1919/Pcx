# Agent Handoff: Stage 3 Shell Adapters and Durable Logs

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: (fill after merge)
- Date: 2026-08-16

## Outcome

The Stage 3 control plane (`scripts/control-plane.mjs`) now has a real shell git adapter and a durable, secret-free log store. `createShellGit` returns a git adapter (`addWorktree`, `removeWorktree`, `mergeBranch`) that executes git commands via `execFile` (no shell interpolation) with explicit argument arrays, validating agent branches and `.worktrees/` paths before execution. `createFileLogStore` persists sanitized JSONL records under `.worktrees/` and reads them back, restricted to an allow-list and rejecting secret-bearing fields. `appendRunRecord` maps a completed worker record to a durable entry and is best-effort (returns null without a store). Both factories accept injected `run`/`write`/`read` functions for deterministic testing.

## Changed areas

- `scripts/control-plane.mjs` — added `asAgentBranch`, `asWorktreePath`, `asMergeTarget`, `createShellGit`, `defaultGitRun`, `extractConflicts`, `sanitizeLogRecord`, `createFileLogStore`, and `appendRunRecord`.
- `scripts/control-plane.test.mjs` — added deterministic tests for shell git input validation/delegation, merge-conflict reporting, log-store sanitization/secret rejection, `.worktrees/` path enforcement, and run-record mapping.
- `docs/tasks/STAGE3_SHELL_ADAPTERS_LOGS.md` — completed bounded task record.
- `docs/status/PROJECT_STATUS.md` — updated Stage 3 evidence, verification baseline (240 tests), latest evidence link, and next dependency-ready work.

## Acceptance criteria

- [x] `createShellGit` validates inputs and delegates to an injected `run`; the default executes git via `execFile` with no shell interpolation.
- [x] Merge conflicts are reported deterministically.
- [x] `createFileLogStore` persists sanitized JSONL records and rejects prohibited/secret-bearing fields.
- [x] `appendRunRecord` maps a worker record to a durable entry and is best-effort.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs` | Pass: 27/27 |
| `npm run verify` | Pass: 240 tests (218 pass, 22 PostgreSQL skips by design, 0 failed), build pass, security scan pass |
| `git diff --check` | Pass |

## Architecture/security review

- The shell adapter uses `execFile` with explicit argument arrays (no shell interpolation) and validates all inputs (agent branches, `.worktrees/` paths, safe merge targets).
- The log store is restricted to `.worktrees/` paths and an allow-list of metadata fields; secret-bearing values are rejected.
- No credentials, customer data, or private evidence are persisted. No commerce-domain invariant changes. ADR 0005 (accepted) governs the Stage 3 control plane.

## Schema/configuration/deployment

None. Repository-local tooling only; no business API, schema, or UI changes. Rollback: remove the new exports to return to injected-only behavior.

## Remaining work and next safe action

1. Wire the durable log store into the parallel worker driver so every run is persisted, and add vendor adapters (sandbox payment/courier/notification) behind the injected adapter contract.
2. Complete safe Stage 2 release slices: container image scan when an image exists, plus sandbox payment/courier/notification adapters.
3. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None. Production deployment, real provider credentials, destructive migrations, production/customer data actions, and core security/invariant changes remain hard stops.
