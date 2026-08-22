# Task: Stage 3 agent stuck-state hardening

- Status: Complete
- Owner/agent: PCX coding agent
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Medium
- Related epic: Stage 3 control-plane foundation
- Related ADRs: `docs/adr/0005-stage3-control-plane.md`

## Objective

Make the bounded local orchestration loop fail fast and recover cleanly from Git merge state, failed dependencies, stale task statuses, and batch limits so an external agent executor cannot leave the repository or graph apparently stuck.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/adr/0005-stage3-control-plane.md`

## Scope

- Enforce an explicit merge target in the shell Git adapter.
- Abort failed merges and expose cleanup failures as task failures.
- Propagate failed/blocked dependencies to durable `BLOCKED` task status.
- Enforce `maxBatches` during execution.
- Reject dirty/unresolved integration state before real worktree orchestration.
- Add tests for the above behavior and document external executor limitations.

## Non-scope

- Production deployment, real credentials, destructive branch deletion, or automatic cleanup of pre-existing branches.
- Vendor-specific Cline or DeepSeek API integration; the executor remains an injected boundary.
- Changing PCX business invariants or source-of-truth rules.

## Domain invariants affected

- No commerce domain data is changed. Git/task lifecycle state remains server/tool-owned and auditable.
- Failed work is never reported as passed; blocked dependents are explicit.

## Acceptance criteria

- [x] Real merges verify/use the requested integration target and abort conflicts.
- [x] Failed dependencies become durable `BLOCKED` tasks with clear reason.
- [x] Batch limits stop execution before the next batch.
- [x] Dirty or unresolved integration state fails closed before real worktree orchestration.
- [x] Relevant tests and `npm run verify:e0`, `npm test` pass.

## State/API/schema/UI impact

Task graph statuses may be updated from `PENDING` to `BLOCKED`; no API/schema/UI change.

## Security and privacy review

No credentials or provider destinations are added. Git command arguments remain validated and passed without shell interpolation. Cleanup is fail-closed and logs remain secret-free.

## Test plan

- Unit: control-plane graph propagation, Git adapter argument/cleanup behavior, batch limits.
- Integration: injected Git adapter orchestration tests.
- Full gate: `npm run verify:e0`, `npm test`, `npm run verify`.

## Migration and rollback

None. Rollback is a code revert; no database migration.

## Prohibited changes / hard stops

No production deployment, production secret/provider change, destructive migration, customer-data deletion, test/security weakening, or core invariant/source-of-truth change.
