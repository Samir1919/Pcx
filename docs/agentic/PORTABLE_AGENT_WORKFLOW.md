# Portable Agent Workflow

This repository is designed to survive changes in editor, model, vendor, and chat session. Repository artifacts—not conversational memory—carry project truth.

## Authority hierarchy

1. Human instructions for the current task
2. `AGENTS.md`
3. Approved specifications in `docs/specifications/`, in the order defined by `docs/brain/README.md`
4. Accepted ADRs in `docs/adr/`
5. Relevant brain summaries in `docs/brain/`
6. Bounded task specification
7. Existing implementation patterns and tests
8. Tool-specific adapter instructions

An adapter cannot override a higher authority. If two approved sources conflict, stop and report the conflict according to the source hierarchy.

## Session startup

1. Confirm repository root, branch, remote, and working-tree state.
2. Read `AGENTS.md` completely.
3. Read the brain index and relevant approved source sections.
4. Read the active task file and related ADRs.
5. Restate scope, non-scope, hard stops, acceptance criteria, risks, and expected tests.
6. Do not code until the bounded task is internally consistent.

## Execution loop

```text
Ground context → specify bounded slice → inspect code/tests
→ implement smallest coherent change → targeted tests
→ full relevant gates → security/architecture self-review
→ fix findings → commit → portable handoff
```

Agents must not claim success from generated code alone. Completion requires observable verification appropriate to the change.

## Branch and commit rules

- Use one isolated branch per epic or coherent slice: `agent/<short-description>`.
- Never rewrite shared published history.
- Keep commits small and purposeful; include the epic/slice intent.
- Never stage unrelated user work.
- Do not merge or deploy merely because tests pass; follow human and repository gates.

## Standard commands

```bash
npm install
npm run verify:e0
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

Use targeted tests during implementation and `npm run verify` before a completion commit. If a check cannot run, record the exact reason and do not represent it as passing.

## Cross-agent continuity

Before handing off, create or update a handoff note containing:

- objective and completed scope
- branch and commit
- files/modules changed
- acceptance criteria status
- commands run and exact result summary
- architecture/security decisions and ADR status
- migrations/configuration changes
- unresolved findings, blockers, and next safe task

The next agent must verify repository state rather than trusting the note blindly.

## Security-sensitive work

Authentication/RBAC, PII, uploads, inspection evidence, payments/refunds, public passports, privileged administration, secrets, and external callbacks require an explicit security review section in the task and handoff. Production policy, credentials, destructive migrations, and deployment remain hard stops.

## Vendor-neutral principle

No implementation may depend on hidden model memory or a vendor-only planning artifact. Important decisions belong in specs, ADRs, task files, tests, or handoffs committed to the repository.

## Evolution policy

Use `AUTONOMY_EVOLUTION_ROADMAP.md` to decide how much automation and infrastructure the current project stage justifies. Complexity is added by measured triggers and risk, not by aspiration alone.
