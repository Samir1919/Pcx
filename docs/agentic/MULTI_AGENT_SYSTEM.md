# PCX Multi-Agent System

PCX uses a portable coordination protocol, not a vendor-specific swarm runtime. Any capable model or editor can fill these roles while repository files preserve shared truth.

## Roles

### Orchestrator

Owns the bounded objective, task DAG, dependency order, non-overlapping assignments, integration branch, budgets, hard stops, and final report. It does not delegate authority the human did not grant.

### Spec agent

Grounds the request in approved sources and produces scope, non-scope, invariants, acceptance criteria, edge cases, security implications, and test expectations. It does not invent missing business policy.

### Planner/architect

Maps affected modules, files, API/schema/state impacts, dependencies, migration compatibility, risks, and rollback. New architecture requires the appropriate ADR.

### Worker

Implements one coherent, non-overlapping task. It runs targeted checks, self-reviews, and records exactly what changed. A worker does not merge, deploy, or change another worker's scope silently.

### Reviewer

Independently checks requirement coverage, invariants, authorization/ownership, concurrency, idempotency, sensitive-data exposure, compatibility, and unnecessary complexity. Findings are BLOCKER, MAJOR, MINOR, or NIT. BLOCKER/MAJOR findings must be resolved or explicitly waived by an authorized human.

### QA agent

Runs relevant unit, integration, E2E, concurrency, migration, and regression gates. It records commands and results and does not turn a failing/unrun check into a pass.

### Security agent

Mandatory for identity/RBAC, PII, uploads, inspection evidence, payments/refunds, public passports, privileged operations, secrets, and callbacks. It reviews threat boundaries and cannot approve production policy on behalf of a human.

### DevOps agent

Validates builds, containers, migrations, staging readiness, rollback, observability, and runbooks. Production deployment remains a hard stop.

### Reporter/handoff owner

Creates the durable completion record from `HANDOFF_TEMPLATE.md`, including branch, commit, tests, risks, blockers, and next safe task.

## Coordination contract

1. Orchestrator creates a task DAG from an approved bounded objective.
2. Each node declares inputs, outputs, affected files/modules, dependencies, prohibited changes, and tests.
3. Parallel nodes must not edit the same module, migration, or generated artifact unless coordination is explicit.
4. Each worker uses an isolated branch/worktree where supported.
5. Reviewer and QA evaluate the integrated diff, not only individual worker claims.
6. Security review is added when the affected surface requires it.
7. Orchestrator integrates only after dependency and gate checks.
8. Reporter writes a portable handoff; conversational summaries alone are insufficient.

## Durable coordination files

- `docs/tasks/`: active or completed bounded task specifications
- `docs/handoffs/`: cross-session and cross-agent continuation records
- `docs/adr/`: architecture decisions and supersession history
- tests and CI: executable acceptance evidence
- git branches/commits: isolated change history

## Parallel-work safety

- Prefer read-only analysis in parallel with a single writer when file overlap is likely.
- Assign separate modules/files for parallel implementation.
- Never let two agents independently create or reorder the same database migration.
- Never merge a worker branch solely because its author says tests pass.
- Never use a sub-agent to bypass permissions, approvals, secrets boundaries, or production gates.

## When to use one agent

Use a single agent for small, tightly coupled changes where coordination overhead exceeds benefit. Multi-agent work is useful for independent research, implementation in separate modules, review, QA, or security assessment.

## Completion

A multi-agent run is complete only when integrated acceptance criteria pass, reviewer blockers are resolved, security review passes where required, the full relevant verification runs, and a durable handoff exists.
