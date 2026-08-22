# Agent Handoff: Stage 3 Driver Log Wiring

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: (fill after merge)
- Date: 2026-08-16

## Outcome

The parallel worker driver (`runParallelWorkers` in `scripts/control-plane.mjs`) now accepts a `logStore` option and persists every completed run to a durable, secret-free JSONL log. After each worker record is produced (both sequential deferred and parallel batch paths), it is persisted via `appendRunRecord({ store: logStore, record, batch })`. Persistence is best-effort observability: when no `logStore` is provided, behavior is unchanged. This gives the Stage 3 control plane auditable run records without broadening authority or exposing secrets.

## Changed areas

- `scripts/control-plane.mjs` — added a `logStore` option to `runParallelWorkers` and a `persist` helper that records each run and appends it to the log store when provided.
- `scripts/control-plane.test.mjs` — added a deterministic test verifying that when a `logStore` is provided, every run is persisted with the correct taskId, status, commit, and an integer batch.
- `docs/tasks/STAGE3_DRIVER_LOG_WIRING.md` — completed bounded task record.
- `docs/status/PROJECT_STATUS.md` — updated Stage 3 evidence, verification baseline (241 tests), latest evidence link, and next dependency-ready work.

## Acceptance criteria

- [x] `runParallelWorkers` accepts a `logStore` and persists every run when provided.
- [x] Behavior is unchanged when no `logStore` is provided.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs` | Pass: 28/28 |
| `npm run verify` | Pass: 241 tests (219 pass, 22 PostgreSQL skips by design, 0 failed), build pass, security scan pass |
| `git diff --check` | Pass |

## Architecture/security review

- The driver persists metadata only (taskId, status, failureClass, attempts, costUnits, QA/security/review verdicts, commit, batch) and never secrets.
- The log store is restricted to `.worktrees/` paths and an allow-list of fields; secret-bearing values are rejected.
- No credentials, customer data, or private evidence are persisted. No commerce-domain invariant changes. ADR 0005 (accepted) governs the Stage 3 control plane.

## Schema/configuration/deployment

None. Repository-local tooling only; no business API, schema, or UI changes. Rollback: remove the `logStore` wiring to return to in-memory-only records.

## Remaining work and next safe action

1. Add vendor adapters (sandbox payment/courier/notification) behind the injected adapter contract.
2. Complete safe Stage 2 release slices: container image scan when an image exists, plus sandbox payment/courier/notification adapters.
3. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None. Production deployment, real provider credentials, destructive migrations, production/customer data actions, and core security/invariant changes remain hard stops.
