# Task: Stage 3 Driver Log Wiring

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Security-sensitive
- Related epic: E0 / E16 / E18
- Related ADRs: ADR 0005 (accepted)

## Objective

Wire the durable, secret-free log store into the parallel worker driver so every completed run is persisted to a repository-local JSONL log, giving the Stage 3 control plane auditable run records without broadening authority or exposing secrets.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/MULTI_AGENT_SYSTEM.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/tasks/STAGE3_SHELL_ADAPTERS_LOGS.md`

## Scope

- Add a `logStore` option to `runParallelWorkers`.
- After each worker record is produced (both sequential deferred and parallel batch paths), persist it via `appendRunRecord({ store: logStore, record, batch })`.
- Persistence is best-effort observability: when no `logStore` is provided, behavior is unchanged.
- Add a deterministic test verifying that when a `logStore` is provided, every run is persisted with the correct taskId, status, commit, and an integer batch.

## Non-scope

- Vendor adapters (sandbox payment/courier/notification) and real provider credentials.
- Production deployment, destructive migrations, or customer-data actions.

## Domain invariants affected

No commerce invariant changes. The driver persists metadata only (taskId, status, failureClass, attempts, costUnits, verdicts, commit, batch) and never secrets.

## Acceptance criteria

- [x] `runParallelWorkers` accepts a `logStore` and persists every run when provided.
- [x] Behavior is unchanged when no `logStore` is provided.
- [x] Deterministic test and `npm run verify` pass.

## State/API/schema/UI impact

Repository-local tooling only. No business API, schema, or UI changes.

## Security and privacy review

The log store is restricted to `.worktrees/` paths and an allow-list of metadata fields; secret-bearing values are rejected. No credentials, customer data, or private evidence are persisted.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove the `logStore` wiring to return to in-memory-only records.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops. No production action, real credential, destructive migration, data deletion, merge, or deployment.
