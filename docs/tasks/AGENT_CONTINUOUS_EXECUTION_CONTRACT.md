# Task: Agent Continuous-Execution Contract

- Status: Complete
- Owner/agent: Codex
- Branch: `agent/e1-auth-runtime-composition`
- Risk: Low
- Related epic: E0
- Related ADRs: None

## Objective

Make open-ended continuation instructions durable across agents and sessions so a completed slice is not mistaken for the requested terminal outcome.

## Source-of-truth references

- Current human instruction
- `AGENTS.md`
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`

## Scope

- Define persistent continuation semantics in the root contract, bootstrap prompt, and portable workflow.
- Define the only valid terminal conditions for an open continuation instruction.

## Non-scope

- New orchestration service, multi-agent control plane, deployment automation, or weakening bounded tasks/checks/hard stops.

## Domain invariants affected

- None.

## Acceptance criteria

- [x] Future agents are told that verified slices/commits/handoffs are checkpoints under a continuation instruction.
- [x] Valid stop conditions preserve all human hard stops and decision authority.
- [x] The change does not introduce Stage 3 orchestration before roadmap entry criteria.

## State/API/schema/UI impact

Agent workflow documentation only.

## Security and privacy review

Hard stops remain absolute. Continuous execution does not broaden authority or authorize production/destructive/security-sensitive external actions.

## Test plan

- Documentation inspection and `npm run verify:e0`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No weakening approvals, tests, security controls, or source-of-truth hierarchy.
