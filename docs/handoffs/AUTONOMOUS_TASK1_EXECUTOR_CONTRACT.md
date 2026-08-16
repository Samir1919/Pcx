# Handoff: Task 1 — Vendor-neutral external-agent executor contract

- Status: Complete
- Branch: `agent/autonomous-safe-slices`
- Date: 2026-08-17
- Related ADR: `docs/adr/0007-vendor-neutral-executor-contract.md`

## Outcome

Defined and implemented a vendor-neutral external-agent executor contract so any future agent executor (Cline, DeepSeek, or other automation) can be wired into the Stage 3 control plane safely, without coupling to a specific vendor or hidden model state.

## Changed areas

- `docs/adr/0007-vendor-neutral-executor-contract.md` — new ADR documenting the contract.
- `scripts/control-plane.mjs` — added `validateExecutorResult(result, { requireArtifacts })` and wired it into `runBoundedTask` so every executor result is validated (secret-free, repository-relative, verifiable).
- `scripts/control-plane.test.mjs` — added 6 tests covering valid, invalid, secret-bearing, traversal, and empty-artifact results.
- `docs/tasks/AUTONOMOUS_SAFE_SLICES.md` — task spec.

## Acceptance criteria

- [x] ADR 0007 documents the vendor-neutral executor contract.
- [x] Executor output validation helper exists and is tested.
- [x] `npm run verify:e0` passes.
- [x] `npm test` passes (263 pass, 0 fail).

## Architecture

The executor contract (ADR 0007) requires an async function invoked as `executor({ task, actions, attempt, signal })` resolving to `{ artifacts: [{ type, path, status }] }`. `validateExecutorResult` enforces: object result, at most 100 artifacts, exactly `type`/`path`/`status` fields (rejecting any other field, e.g. secrets), repository-relative paths without traversal, and at least one artifact when `requireArtifacts` is set. `runBoundedTask` now calls `validateExecutorResult(executionResult, { requireArtifacts: true })`, so a PASSED task must produce verifiable output.

## Schema

No schema change.

## Remaining

- Wiring a specific vendor executor (Cline/DeepSeek) is intentionally out of scope; the contract is the prerequisite.

## Blockers

None.

## Verification

- `node --test scripts/control-plane.test.mjs` — 39 pass.
- `npm run verify:e0` — E0 verified: 36 required artifacts.
- `npm test` — 263 pass, 0 fail, 22 skipped (DB integration).
