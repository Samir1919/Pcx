# ADR 0005: Stage 3 policy-constrained agent control plane

- Status: Accepted
- Date: 2026-08-16

## Context

PCX already has a controlled Stage 1 workflow and most Stage 2 integration/release gates. The repository specifications describe orchestrator, worker, reviewer, QA, security, DevOps, and reporter roles, but those roles currently exist as a portable protocol rather than an executable control plane.

The requested direction is higher autonomy with less repeated human interaction. The approved roadmap does not permit unsafe authority expansion or premature orchestration. Stage 3 therefore needs an explicit, evidence-gated design that increases throughput while preserving traceability and human control over production, financial, security, data, and invariant-sensitive actions.

## Decision

Adopt a lightweight, repository-native Stage 3 control-plane implementation in bounded slices. The first implementation target is a policy-constrained task runner, not a general-purpose agent platform.

The control plane will require:

- explicit task DAG nodes with owner, dependency, scope, affected paths, tests, risk, and prohibited actions;
- default-deny policy evaluation for high-risk actions;
- bounded retries, timeouts, budgets, and cancellation/kill-switch behavior;
- isolated branch/worktree execution for parallel-safe work;
- overlap checks for files, modules, migrations, and generated artifacts;
- independent review, QA, and mandatory security gates where required;
- integrated verification on a candidate branch before handoff;
- append-only, secret-free action/artifact records and portable handoffs.

The control plane will not autonomously:

- deploy to production;
- use or rotate production secrets;
- change payment destinations or provider credentials;
- delete customer/production data;
- run destructive migrations;
- weaken tests/security controls;
- change core domain invariants or source-of-truth rules;
- approve privileged financial or security-sensitive actions without the existing human gate.

Initial execution remains local/CI-oriented and synthetic-data-only. A worker can create code changes and verification artifacts in an isolated branch, but merge, deployment, and hard-stop actions remain governed by existing repository and human approval controls.

## Alternatives considered

### Continue with documents only

Lowest implementation cost, but does not provide reliable DAG, overlap, retry, budget, or action-trace enforcement as parallel work increases.

### Build a dynamic worker platform immediately

Rejected as premature and inconsistent with the roadmap anti-overengineering rule. It adds operational complexity before measured coordination evidence exists.

### Use an external vendor-specific orchestration service

Rejected for the foundation. It would make durable project truth dependent on hidden vendor state and complicate auditability and portability.

## Consequences

### Positive

- Higher safe throughput for dependency-independent bounded tasks.
- Explicit evidence for why a task ran, what it changed, and which gates passed.
- Reduced duplicated work and merge conflicts.
- Existing security and hard-stop controls become machine-enforceable rather than only procedural.

### Negative

- New repository tooling requires maintenance and testing.
- Agent runtime/cost/artifact tracking must be designed carefully.
- Parallelism remains intentionally limited for migrations, shared contracts, and sensitive modules.
- Full production autonomy is explicitly not the outcome of this ADR.

## Rollout and rollback

Roll out in stages:

1. task/DAG schema and validator;
2. policy and hard-stop evaluator;
3. bounded local runner with timeout/retry/budget limits;
4. branch/worktree and overlap checks;
5. reviewer/QA/security gate adapters;
6. integration candidate and report/handoff generation.

Each stage must pass deterministic tests and `npm run verify` before the next is enabled. Disable the runner and return to the existing manual workflow if policy evaluation, artifact recording, isolation, or verification becomes unreliable. No business data migration is required for the foundation.

## Success metrics

- 100% of automated task runs have a task ID, scope, owner, policy result, artifacts, verification result, and handoff.
- 0 production/hard-stop actions performed by the runner.
- 0 overlapping migration writers admitted concurrently.
- Bounded retry/timeout/budget violations are rejected deterministically.
- Integrated verification is required before a candidate is reported ready.
- Measure merge conflict rate, duplicated-task rate, runtime, retry rate, and cost before expanding parallelism.

## Controls that remain manual

Production deployment, production credentials/secrets, payment destinations, destructive migrations, customer-data deletion, core invariant/source-of-truth changes, and material security-policy changes remain human approval gates under `AGENTS.md`.

## Approval

Accepted for bounded local/CI implementation by the human instruction to proceed and continue. Acceptance authorizes the staged repository-native control-plane work in this ADR, but does not authorize production deployment or any existing hard stop.
