# Task: Stage 3 Shell Adapters and Durable Logs

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Security-sensitive
- Related epic: E0 / E16 / E18
- Related ADRs: ADR 0005 (accepted)

## Objective

Add a real shell git adapter and a durable, secret-free action/artifact log store to the Stage 3 control plane so the parallel worker driver can execute repository-local git operations and persist auditable run records without broadening authority or exposing secrets.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/MULTI_AGENT_SYSTEM.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/tasks/STAGE3_WORKTREE_ORCHESTRATION.md`

## Scope

- `createShellGit`: a factory returning a real git adapter (`addWorktree`, `removeWorktree`, `mergeBranch`) that executes git commands via `execFile` (no shell interpolation) with explicit argument arrays, validating agent branches and `.worktrees/` paths before execution. A `run` function may be injected for deterministic testing; the default executes real git.
- `createFileLogStore`: a durable JSONL log store under `.worktrees/` that appends sanitized records and reads them back. Records are restricted to an allow-list and reject secret-bearing fields. A `write`/`read` pair may be injected for deterministic testing; the default uses `node:fs`.
- `appendRunRecord`: maps a completed worker record to a sanitized durable log entry (taskId, status, failureClass, attempts, costUnits, QA/security/review verdicts, commit, batch).
- Deterministic unit tests for all three.

## Non-scope

- Wiring the log store into the driver loop (deferred to the next slice).
- Vendor adapters (sandbox payment/courier/notification) and real provider credentials.
- Production deployment, destructive migrations, or customer-data actions.

## Domain invariants affected

No commerce invariant changes. The shell adapter is restricted to repository-local git worktree/merge operations on `agent/` branches; it cannot broaden authority or bypass hard stops. The log store persists metadata only and never secrets.

## Acceptance criteria

- [x] `createShellGit` validates inputs and delegates to an injected `run`; the default executes git via `execFile` with no shell interpolation.
- [x] Merge conflicts are reported deterministically.
- [x] `createFileLogStore` persists sanitized JSONL records and rejects prohibited/secret-bearing fields.
- [x] `appendRunRecord` maps a worker record to a durable entry and is best-effort (returns null without a store).
- [x] Deterministic tests and `npm run verify` pass.

## State/API/schema/UI impact

Repository-local tooling only. No business API, schema, or UI changes.

## Security and privacy review

The shell adapter uses `execFile` with explicit argument arrays (no shell interpolation) and validates all inputs. The log store is restricted to `.worktrees/` paths and an allow-list of metadata fields; secret-bearing values are rejected. No credentials, customer data, or private evidence are persisted.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove the new exports to return to injected-only behavior.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops. No production action, real credential, destructive migration, data deletion, merge, or deployment.
