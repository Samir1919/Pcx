# Task: Stage 3 Bounded Local Runner

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Security-sensitive
- Related epic: E0 / E16
- Related ADRs: ADR 0005 (accepted)

## Objective

Implement a local, side-effect-injected task runner that enforces policy, retry, timeout, budget, cancellation, kill-switch, and secret-free artifact metadata before any future worker adapter is enabled.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/MULTI_AGENT_SYSTEM.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/tasks/STAGE3_CONTROL_PLANE_FOUNDATION.md`

## Scope

- Validate declared task actions through the default-deny policy.
- Run only an injected local executor; do not spawn arbitrary shell commands.
- Enforce bounded attempts, timeout, budget, cancellation, and kill-switch checks.
- Return deterministic status, attempts, cost, failure class, and sanitized artifact metadata.
- Add deterministic unit tests.

## Non-scope

- Shell command execution, model/vendor API invocation, branch/worktree creation, parallel workers, PR/merge, deployment, or credentials.
- Reviewer/QA/security adapters and integrated candidate branches.

## Domain invariants affected

No commerce invariant changes. The runner cannot broaden repository authority or bypass hard stops.

## Acceptance criteria

- [x] Undeclared/default-denied/hard-stop actions never reach the executor.
- [x] Retry count, timeout, and budget are bounded.
- [x] Abort signal and kill switch stop execution.
- [x] Artifacts retain allow-listed metadata only and reject secret-bearing fields.
- [x] Deterministic tests and `npm run verify` pass.

## State/API/schema/UI impact

Repository-local tooling only. No business API, schema, or UI changes.

## Security and privacy review

Default deny is mandatory. Executor output cannot persist tokens, secrets, credentials, raw prompts, customer data, or private evidence. Production environment remains denied.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove/disable the runner export to return to validator-only behavior.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops. No production action, real credential, destructive migration, data deletion, merge, or deployment.
