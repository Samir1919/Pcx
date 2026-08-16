# Task: Stage 3 Control Plane Foundation

- Status: In progress
- Owner/agent: Codex
- Branch: `agent/stage3-control-plane-foundation`
- Risk: Medium / Security-sensitive
- Related epic: E0 / E16 / E18
- Related ADRs: ADR 0005 (proposed)

## Objective

Create the first bounded, repository-native foundation for policy-constrained multi-agent execution without granting production or irreversible authority.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/agentic/MULTI_AGENT_SYSTEM.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/specifications/PROJECT_BRAIN_AGENTIC_SYSTEM.md`
- `docs/specifications/INFRASTRUCTURE_DEVOPS.md`
- `docs/status/PROJECT_STATUS.md`

## Scope

- Record the Stage 3 adoption plan and evidence requirements.
- Define a repository-native control-plane contract for task DAGs, bounded workers, reviews, QA, security gates, artifacts, retries, timeouts, budgets, and kill-switch behavior.
- Preserve the existing Stage 1/2 controls and all human hard stops.
- Add only safe, local, auditable planning/execution primitives in later bounded slices.
- Synchronize status evidence and the next dependency-ready work after verification.

## Non-scope

- Production deployment or staging deployment with real credentials.
- Real payment, courier, notification, or cloud provider credentials.
- Destructive/irreversible migrations or customer-data deletion.
- Autonomous approval of payments, refunds, permissions, secrets, core invariants, or production releases.
- Kubernetes, microservices, or a dynamic worker platform without measured need and a new ADR.

## Domain invariants affected

- No commerce-domain invariant changes.
- Server-owned state, authorization, idempotency, privacy, and audit controls remain authoritative.
- Agent permissions cannot broaden authority beyond the human task and repository hard stops.

## Acceptance criteria

- [ ] ADR 0005 records triggers, scope, controls, rollout, rollback, metrics, and manual approval boundaries.
- [ ] A bounded implementation sequence exists for the control-plane capabilities.
- [ ] Stage 3 work is explicitly gated by evidence and does not claim production autonomy.
- [ ] Existing verification, security, branch, review, handoff, and hard-stop controls remain mandatory.
- [ ] Status and handoff records identify the next safe implementation slice.

## State/API/schema/UI impact

Documentation and repository tooling only in this slice. No business schema, API, or UI changes.

## Security and privacy review

The control plane must default-deny high-risk actions, enforce task scope, record action/artifact metadata without secrets, cap retries/timeouts/budgets, and expose a kill switch. Security review is mandatory for auth, payment/refund, PII, upload/evidence, public passport, privileged admin, secrets, and external callbacks.

## Test plan

- Documentation and artifact verification: `npm run verify:e0`.
- Validate task/ADR references and status consistency.
- Later implementation slices must add deterministic unit tests for policy decisions, DAG validation, overlap detection, retry/timeout limits, and hard-stop enforcement.
- Full gate before implementation-slice completion: `npm run verify`.

## Migration and rollback

None for this documentation-only foundation. Future persistence or service changes require additive migration design, compatibility analysis, and a separate bounded task. Destructive migration remains a hard stop.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops apply. No production side effects, real credentials, test/security weakening, silent authority expansion, or autonomous bypass of human approval boundaries.
