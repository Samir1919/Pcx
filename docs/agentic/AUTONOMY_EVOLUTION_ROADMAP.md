# Agentic Engineering Evolution Roadmap

- Status: Approved guideline
- Applies to: PCX engineering lifecycle
- Principle: Add control and automation when product risk, team coordination, or operational evidence requires it—not merely because the technology exists.

## Target progression

```text
Stage 1 — Now
Mini execution workflow
+ PCX Project Brain
+ Security/hard stops
+ Branch/test/review/handoff
        ↓
Stage 2 — MVP grows
Real CI + integration tests
+ migrations
+ staging
+ security scans
        ↓
Stage 3 — Team/traffic grows
Task DAG automation
+ isolated worktrees
+ independent review agents
+ policy engine
        ↓
Stage 4 — Production maturity
Full observability
+ controlled deployment
+ rollback/incident loop
```

Stages are cumulative. Moving forward does not remove controls from an earlier stage.

## Stage 1 — Lean controlled agentic development

### Goal

Build the MVP quickly while keeping business truth, security boundaries, and cross-agent continuity explicit.

### Required capabilities

- `AGENTS.md`, approved specifications, Project Brain, and accepted ADRs
- bounded task specifications with scope/non-scope and acceptance criteria
- one coherent branch per slice
- targeted automated tests and `npm run verify`
- security self-review for sensitive surfaces
- reviewed commit, safe merge, and portable handoff
- human hard stops for production deployment, destructive migration, credentials, payment destinations, and core invariants

### Default execution model

Prefer one primary implementation agent. Add focused read-only review, research, QA, or security agents only when they provide clear value. Do not build an orchestration service in this stage.

### Exit criteria

Move toward Stage 2 when at least one of these becomes true:

- persistent database migrations and real integration boundaries are introduced
- authentication, payments, inventory reservation, refunds, or other critical workflows become executable
- multiple application packages need coordinated build/test gates
- manual verification repeatedly misses regressions
- staging or external sandbox integrations are required for credible validation

## Stage 2 — MVP integration and release discipline

### Goal

Prove that the integrated system works from a clean environment and can be released safely to staging.

### Required capabilities

- locked dependency installation in CI
- lint, typecheck, unit, integration, migration, and build gates
- ephemeral test database/services using synthetic fixtures
- version-controlled additive migrations and expand-contract governance
- production-like staging with sandbox payment/courier/notification adapters where applicable
- secret, dependency, and baseline security scanning
- critical E2E paths: acquisition, inspection, listing, unique reservation/order, payment reconciliation, fulfilment, return, and warranty as they become available
- restoreable test backups before launch-sensitive changes

### Promotion rule

A feature does not become staging-ready merely because unit tests pass. Relevant integration, migration, security, and smoke gates must also pass.

### Exit criteria

Move toward Stage 3 when at least one of these becomes persistent:

- two or more developers/agents regularly work on independent tasks
- coordination conflicts, duplicated work, or merge failures consume material time
- backlog contains multiple dependency-ready tasks that benefit from parallel execution
- review/security/QA bottlenecks delay delivery
- cost, retry, timeout, and artifact tracking require centralized visibility

## Stage 3 — Coordinated multi-agent control plane

### Goal

Increase safe parallel throughput without losing traceability or allowing agents to broaden their own authority.

### Required capabilities

- explicit task DAG with dependency and ownership metadata
- orchestrator tracking status, retries, timeouts, budgets, failures, and artifacts
- isolated branches/worktrees or sandboxes for non-overlapping workers
- automated overlap/conflict checks for files, modules, and migrations
- independent reviewer plus QA; mandatory security agent for sensitive domains
- integration candidate branch and fresh integrated verification
- policy engine enforcing allowed tools/actions, approval boundaries, retry limits, and kill switch
- agent action logs and cost/runtime reporting

### Parallelism rule

Parallelize only dependency-independent work. Database migrations, shared contracts, or the same module have a single coordinated writer unless the plan explicitly sequences them.

### Exit criteria

Move toward Stage 4 when PCX has real users/transactions and operational reliability becomes a business requirement, including one or more of:

- production deployment occurs regularly
- payment/order/inventory incidents have material customer or financial impact
- uptime, latency, queue delay, error rate, RPO, or RTO require measurable objectives
- rollback and incident response must be rehearsed rather than improvised
- multiple services/workers/integrations need correlated operational visibility

## Stage 4 — Production-grade autonomous delivery and recovery

### Goal

Make releases observable, controlled, reversible, and auditable while preserving human authority over high-risk actions.

### Required capabilities

- structured logs, correlation IDs, metrics, traces where justified, error tracking, and actionable alerts
- service and business SLOs for checkout, payment, reservation, inspection throughput, and background jobs
- immutable build artifacts and controlled staging-to-production promotion
- migration rehearsal, health/smoke gates, rollback plan, and post-deploy verification
- automated incident detection and safe application rollback where technically proven
- repair task creation linked to deployment/incident evidence
- backup monitoring and routine restore drills
- deployment, rollback, payment mismatch, stuck reservation, queue backlog, object-storage failure, and account-compromise runbooks
- production audit trail, least privilege, secrets management, and emergency kill controls

### Human approval boundary

Production deployment remains a human gate unless governance is explicitly changed through an approved decision. Destructive migration, customer-data deletion, credential/payment-destination change, and core security/invariant change always retain the hard-stop process defined by `AGENTS.md`.

## Epic alignment

| PCX delivery period | Expected autonomy stage |
|---|---|
| E0–early E1 | Stage 1 |
| E1 persistence through transactional MVP epics | Introduce Stage 2 capabilities incrementally |
| Multiple concurrent teams/agents or sustained parallel backlog | Stage 3 when entry evidence exists |
| E16–E18 and real production operations | Complete Stage 4 release/operations controls |

Epic numbers are guidance, not permission to skip entry criteria or required controls. A high-risk capability may require a later-stage control earlier.

## Decision record for stage changes

Before adopting a new stage, write a short task/ADR recording:

- trigger evidence and current pain/risk
- capabilities being introduced
- cost and maintenance owner
- rollout and rollback plan
- success metrics
- controls that remain manual

## Anti-overengineering rules

- Do not build a dynamic worker platform merely to run one agent.
- Do not introduce Kubernetes, microservices, or a custom policy engine without measured operational need and an ADR.
- Do not automate an unsafe or undefined business process.
- Do not replace deterministic tests/tools with additional agents.
- Do not use more agents when a single bounded agent is faster and safer.

## Non-regression rule

Once PCX depends on a control for a live risk—such as migration validation, authorization tests, payment replay protection, backup restore, or deployment smoke tests—agents may not remove or bypass it to accelerate delivery.
