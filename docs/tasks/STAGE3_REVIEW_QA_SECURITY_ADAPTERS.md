# Task: Stage 3 Review, QA, Security, Verification, and Handoff Adapters

- Status: Complete

- Owner/agent: Cline
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Security-sensitive
- Related epic: E0 / E16
- Related ADRs: ADR 0005 (accepted)

## Objective

Add deterministic, side-effect-injected review, QA, security, integrated-verification, and handoff adapters to the Stage 3 control plane so that a worker's integrated result can be independently evaluated and durably recorded before any parallel worker adapter is enabled.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/MULTI_AGENT_SYSTEM.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/agentic/HANDOFF_TEMPLATE.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/tasks/STAGE3_CONTROL_PLANE_FOUNDATION.md`
- `docs/tasks/STAGE3_BOUNDED_LOCAL_RUNNER.md`
- `docs/tasks/STAGE3_WORKTREE_CONFLICT_PLANNING.md`

## Scope

- Add a review adapter that evaluates a task's integrated result against requirement coverage, invariants, authorization/ownership, concurrency, idempotency, sensitive-data exposure, compatibility, and unnecessary complexity, producing typed findings (BLOCKER/MAJOR/MINOR/NIT).
- Add a QA adapter that runs declared gates and records commands/results without turning a failing or unrun check into a pass.
- Add a security adapter that is mandatory for security-sensitive tasks and reviews threat boundaries.
- Add an integrated-verification adapter that requires all declared gates to pass before a candidate is reported ready.
- Add a handoff adapter that produces a durable, secret-free completion record from the task and adapter results.
- Add deterministic unit tests for each adapter.
- Synchronize status evidence and next dependency-ready work after verification.

## Non-scope

- Shell command execution, model/vendor API invocation, branch/worktree creation, parallel workers, PR/merge, deployment, or credentials.
- Enabling any parallel worker adapter (requires a later slice after these adapters and a new ADR if needed).
- Production deployment or real provider credentials.

## Domain invariants affected

No commerce-domain invariant changes. Adapters cannot broaden repository authority or bypass hard stops. Findings cannot approve production policy on behalf of a human.

## Acceptance criteria

- [x] Review adapter returns typed findings and flags BLOCKER/MAJOR findings that must be resolved or waived by an authorized human.
- [x] QA adapter records gate commands/results and never reports a failing or unrun check as passing.
- [x] Security adapter is required for security-sensitive tasks and reviews threat boundaries.
- [x] Integrated verification requires all declared gates to pass before reporting ready.
- [x] Handoff adapter produces a secret-free durable completion record.
- [x] Deterministic tests and `npm run verify` pass.


## State/API/schema/UI impact

Repository-local tooling only: `scripts/control-plane.mjs` and deterministic tests. No business API, schema, or UI changes.

## Security and privacy review

Adapters must default-deny high-risk actions, never persist secrets/credentials/raw prompts/customer data/private evidence, and never approve production policy. Security review is mandatory for auth, payment/refund, PII, upload/evidence, public passport, privileged admin, secrets, and external callbacks.

## Test plan

- `node --test scripts/control-plane.test.mjs`
- `npm run verify`
- `git diff --check`

## Migration and rollback

None. Remove/disable the adapter exports to return to validator/runner-only behavior.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops. No production action, real credential, destructive migration, data deletion, merge, deployment, or enabling parallel workers.
