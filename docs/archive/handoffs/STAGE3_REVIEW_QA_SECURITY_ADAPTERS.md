# Agent Handoff: Stage 3 Review, QA, Security, Verification, and Handoff Adapters

- Status: Complete
- Branch: `agent/stage3-control-plane-foundation`
- Latest commit: (fill after merge)
- Date: 2026-08-16

## Outcome

The Stage 3 control plane (`scripts/control-plane.mjs`) now exposes deterministic, side-effect-injected review, QA, security, integrated-verification, and handoff adapters. A worker's integrated result can be independently evaluated against requirement coverage, invariants, authorization/ownership, concurrency, idempotency, sensitive-data exposure, compatibility, and unnecessary complexity; declared gates can be recorded without turning a failing or unrun check into a pass; security-sensitive tasks require a security review; a candidate is only reported ready when all declared gates pass; and a durable, secret-free completion record can be produced. No parallel worker adapter is enabled by this slice.

## Changed areas

- `scripts/control-plane.mjs` — added the review, QA, security, integrated-verification, and handoff adapters as pure, injected functions alongside the existing validator/runner/planner. Adapters default-deny high-risk actions, never persist secrets/credentials/raw prompts/customer data/private evidence, and never approve production policy.
- `scripts/control-plane.test.mjs` — added deterministic unit tests covering each adapter's behavior, including BLOCKER/MAJOR finding flagging, gate pass/fail/unrun handling, mandatory security review for security-sensitive tasks, integrated-verification readiness gating, and secret-free handoff output.
- `docs/tasks/STAGE3_REVIEW_QA_SECURITY_ADAPTERS.md` — marked complete with acceptance criteria checked.
- `docs/status/PROJECT_STATUS.md` — updated Stage 3 evidence, verification baseline, latest evidence link, and next dependency-ready work.

## Acceptance criteria

- [x] Review adapter returns typed findings and flags BLOCKER/MAJOR findings that must be resolved or waived by an authorized human.
- [x] QA adapter records gate commands/results and never reports a failing or unrun check as passing.
- [x] Security adapter is required for security-sensitive tasks and reviews threat boundaries.
- [x] Integrated verification requires all declared gates to pass before reporting ready.
- [x] Handoff adapter produces a secret-free durable completion record.
- [x] Deterministic tests and `npm run verify` pass.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs` | Pass (all adapter tests green) |
| `npm run verify:e0` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |

## Architecture/security review

- Adapters are pure and side-effect-injected, keeping them deterministic and testable.
- Adapters cannot broaden repository authority or bypass hard stops; findings cannot approve production policy on behalf of a human.
- Security review is mandatory for security-sensitive tasks (auth, payment/refund, PII, upload/evidence, public passport, privileged admin, secrets, external callbacks).
- No commerce-domain invariant changes. ADR 0005 (accepted) governs the Stage 3 control plane.

## Schema/configuration/deployment

None. Repository-local tooling only; no business API, schema, or UI changes. Rollback: remove/disable the adapter exports to return to validator/runner-only behavior.

## Remaining work and next safe action

1. Add isolated worktree creation and merge orchestration (bounded, local/CI only).
2. Enable parallel worker adapters only after worktree/merge orchestration exists and a new ADR if needed.
3. Complete safe Stage 2 release slices: container image scan when an image exists, plus sandbox payment/courier/notification adapters.

## Blockers requiring human decision

None. Production deployment and real provider credentials remain human-approval hard stops.
