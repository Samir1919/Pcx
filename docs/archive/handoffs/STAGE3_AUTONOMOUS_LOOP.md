# Agent Handoff: Stage 3 Autonomous Orchestration Loop

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: pending (filled on merge)
- Date: 2026-08-16

## Outcome

Added a runnable autonomous orchestration loop driver (`scripts/autonomous-loop.mjs`) that loads a bounded task graph, validates it, and runs every dependency-ready, non-conflicting task through the full control-plane pipeline (bounded execution, QA, security, review, integrated verification, handoff) using the real shell git adapter and durable secret-free log store. The loop terminates when no more dependency-ready work remains because failed tasks are recorded and never re-attempted. A dry-run mode (`--dry-run`) runs the pipeline without creating real git worktrees, so it is safe to run in CI.

## Changed areas

- `scripts/autonomous-loop.mjs` — new driver: `parseArgs` (graph/log/dry-run/max-batches), `loadGraph`, default executor/gates executor, `runAutonomousLoop` (wraps `runParallelWorkers` with injectable executors/git/log store), `writeSummary`, and a CLI `main` that creates the `.worktrees/` directory before writing the log.
- `scripts/autonomous-loop.test.mjs` — new deterministic tests: dependency-ready completion, failed-task termination, durable log persistence, worktree create/merge/remove, sequential deferral of conflicting tasks, invalid-graph rejection, and executor/gatesExecutor validation.
- `work/autonomous-graph.json` — sample task graph (spec → api/web) for the dry-run script.
- `package.json` — added `autonomous:loop` script (`node scripts/autonomous-loop.mjs --dry-run`).
- `docs/tasks/STAGE3_AUTONOMOUS_LOOP.md` — completed bounded task record.
- `docs/status/PROJECT_STATUS.md` — updated Stage 3 evidence, verification baseline, latest evidence link, and next dependency-ready work.

## Acceptance criteria

- [x] `autonomous-loop.mjs` loads and validates a task graph and runs the full pipeline, reporting completed/failed tasks and a durable summary.
- [x] The loop terminates when no more dependency-ready work remains.
- [x] The driver is deterministic and testable with injected executors/git/log store.
- [x] A dry-run mode runs safely in CI without creating real worktrees.
- [x] `npm run verify` passes.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/autonomous-loop.test.mjs` | Pass: 7/7 |
| `node --test scripts/autonomous-loop.test.mjs scripts/control-plane.test.mjs` | Pass: 35/35 |
| `node scripts/autonomous-loop.mjs --dry-run --graph work/autonomous-graph.json` | Pass: 2 batches, completed spec/api/web, 0 failed |
| `npm run verify` | Pass: 271 tests (249 pass, 22 PostgreSQL skips by design, 0 failed), build pass, security scan pass |

## Architecture/security review

- The driver is a thin, deterministic wrapper over the existing `runParallelWorkers`; all side effects (git, log store, executors) are injected, keeping it testable.
- The default executor only emits allow-listed synthetic commit artifacts and never performs a hard-stop action; real agent invocation is intentionally out of scope.
- Worktree plans remain restricted to `agent/` branches and `.worktrees/` repository-relative paths; traversal and absolute paths are rejected by the underlying primitives.
- The driver cannot broaden repository authority or bypass hard stops; merge is not a production deployment and remains governed by existing policy.
- No commerce-domain invariant changes. ADR 0005 (accepted) governs the Stage 3 control plane.

## Schema/configuration/deployment

None. Repository-local tooling only; no business API, schema, or UI changes. Rollback: remove the new files and the `autonomous:loop` script to return to adapter-only behavior.

## Remaining work and next safe action

1. Wire a real agent executor into the autonomous loop (the executor is currently a synthetic no-op; wiring an LLM/agent is the next slice).
2. Add webhook retry/outbox delivery guarantees for the courier webhook (deferred from the courier webhook slice).
3. Complete safe Stage 2 release slices: container image scan when an image exists.
4. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None. Production deployment, real provider credentials, destructive migrations, production/customer data actions, and core security/invariant changes remain hard stops.
