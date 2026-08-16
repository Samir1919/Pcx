# Task: Autonomous orchestration loop driver

## Context

The Stage 3 control plane (`scripts/control-plane.mjs`) exposes the primitives
needed for coordinated multi-agent work: a bounded task runner, review/QA/
security/verification/handoff adapters, worktree orchestration, a parallel
worker driver (`runParallelWorkers`), a real shell git adapter, and a durable
secret-free log store. What is missing is a continuous, runnable driver that
loads a task graph, runs the pipeline with the real adapters, and reports a
durable summary — the "autonomous orchestration loop" that a human or CI can
invoke to process a backlog of dependency-ready tasks.

## Scope

- Add `scripts/autonomous-loop.mjs` that:
  - loads a task graph from a JSON file (path via `--graph`, default
    `work/autonomous-graph.json`);
  - validates the graph with `validateTaskGraph`;
  - runs `runParallelWorkers` with the real shell git adapter and file log
    store (both optional and injectable for deterministic testing);
  - loops until no more dependency-ready work remains (the driver already
    terminates because failed tasks are recorded and never re-attempted);
  - writes a durable summary (completed/failed task ids, batch count, and a
    link to the log store) and a portable handoff record.
- Add `scripts/autonomous-loop.test.mjs` with deterministic tests using
  injected executors, git, and log store.
- Wire a `verify`-safe npm script (`autonomous:loop`) that runs the driver
  against a sample graph in a dry-run mode (no real git worktrees) so it is
  safe to run in CI.

## Out of scope

- Real agent invocation (the executor is injected; wiring an LLM/agent is a
  later slice).
- Production deployment or real provider credentials (hard stop).
- A persistent daemon/service; this is a bounded, terminating loop.

## Acceptance criteria

- `autonomous-loop.mjs` loads and validates a task graph and runs the full
  pipeline, reporting completed/failed tasks and a durable summary.
- The loop terminates when no more dependency-ready work remains.
- The driver is deterministic and testable with injected executors/git/log
  store.
- A dry-run mode runs safely in CI without creating real worktrees.
- `npm run verify` passes.

## Files

- `scripts/autonomous-loop.mjs` (new)
- `scripts/autonomous-loop.test.mjs` (new)
- `package.json` (add `autonomous:loop` script)
- `docs/tasks/STAGE3_AUTONOMOUS_LOOP.md`
- `docs/handoffs/STAGE3_AUTONOMOUS_LOOP.md`
- `docs/status/PROJECT_STATUS.md`
