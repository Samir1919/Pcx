# PCX Agent Contract

Read `docs/brain/README.md` before making material changes. The approved specifications in `docs/specifications/` are the source of truth; concise brain documents are retrieval aids, not replacements.

This contract is tool-neutral. Codex, Claude, Gemini, Copilot, Cursor, VS Code agents, CI agents, and future automation must follow the same hierarchy and hard stops. Tool-specific instruction files may point here but cannot weaken or replace this contract.

## Communication language

Always communicate with the human in Bengali (বাংলা). This is a mandatory, non-negotiable rule for every agent and applies to final summaries, explanations, questions, status updates, and any user-facing message. Code, comments, identifiers, commit messages, documentation, and file contents remain in English.

## Universal onboarding order

1. Read this file completely.
2. Follow `docs/agentic/START_PROMPT.md` as the session bootstrap contract.
3. Read `docs/brain/README.md` and only the brain/spec sections relevant to the task.
4. Read `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`.
5. Create or update a bounded task file from `docs/agentic/TASK_SPEC_TEMPLATE.md`.
6. Inspect the current branch, working tree, affected code, tests, and ADRs.
7. Implement the smallest coherent slice, run required gates, self-review, and write a handoff.
8. Read and update `docs/status/PROJECT_STATUS.md` when a material slice changes epic, maturity-stage, verification, blocker, or next-task state.

For coordinated parallel work, also read `docs/agentic/MULTI_AGENT_SYSTEM.md`. No agent may delegate around a hard stop or grant another agent broader authority than the human provided.

Agentic infrastructure must evolve according to `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`. Do not introduce a heavier orchestration stage before its entry criteria are met; do not skip mandatory controls once their trigger is reached.

## Mandatory invariants

- A physical used item has one unique lifecycle identity.
- `ProductModel` and `InventoryItem` are separate concepts.
- An item cannot be sold twice.
- Client input never authoritatively sets price, totals, role, status, grade, or warranty eligibility.
- Submitted inspection history is preserved.
- Critical inspection overrides are privileged, reasoned, and audited.
- Estimated seller ranges are not final offers.
- Trade-in acquisition and new sale are separate accounting records.
- Order snapshots preserve the sold facts.
- Payment, refund, and acquisition financial operations are idempotent.
- Public passports never expose full serials, acquisition cost, or private evidence.
- State transitions and authorization are enforced on the server.

## Engineering rules

- Work in bounded epics and branches. Prefer the smallest coherent change.
- Preserve modular-monolith boundaries; modules do not manipulate another module's tables directly.
- Write or update tests for changed business behavior.
- Any change to a browser-facing page or flow (`apps/web`, `apps/admin`) must be verified with a real browser before it is reported as done; code review and `curl` are not acceptable substitutes. When the changed surface is UI-browsable, the slice must leave committed headed-browser evidence (`docs/verify/browser-verify.json`, schema in `docs/verify/README.md`): a human-like, start-to-end click-through of the full business flow for the changed surface, run headed (`PCX_HEADED=1` with a `*--e2e-check.mjs --evidence`, or the Playwright MCP tool headed — never headless). `npm run ui-guard` enforces this inside `npm run verify`: a UI-browsable slice without valid headed evidence fails the gate. If the tooling is missing, ask the human before installing/configuring it.
- Run `npm run verify:e0`, `npm test`, and relevant checks before commit.
- After a successful commit, push and merge into `main` (or open/merge a PR) as part of the same slice — a slice is NOT complete while its work remains on an unmerged feature branch. Verify with `node scripts/merge-gate.mjs`; it must report `OK: ... is merged into origin/main` (exit 0). `git push` alone on a feature branch is insufficient.
- Never leave unresolved merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in a tracked file. The `npm run lint` gate fails if any exist, so run it before every commit.
- Never commit credentials, production data, or private evidence.
- Never put a multi-line string inside a shell command. Write commit bodies to a file and use `git commit -F <file>`. See "Shell command safety" in `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`.
- Record approved architecture changes as ADRs; do not silently change business truth.
- When a task or slice completes successfully (checks pass and the change is committed), run `git push` immediately. Always `git push` after a successful commit or merge; never leave completed, committed, or merged work unpushed. If a commit or merge fails, fix it first, then push.

## Hard stops

Stop for explicit human approval before production deployment, destructive/irreversible migration, production/customer-data deletion, payment destination or provider credential changes, production secret rotation, disabling tests/security controls, large framework replacement, or changing a core invariant/source-of-truth.

## Portable completion record

Every material agent run must leave enough durable context for a different agent to continue without chat history: task scope, acceptance criteria, changed files, tests/results, decisions/ADRs, risks, blockers, branch, and latest commit. Use `docs/agentic/HANDOFF_TEMPLATE.md`.

## Continuous-execution contract

When the human gives an open continuation instruction such as “continue,” “take the next dependency-ready task,” “finish the MVP,” or “do not stop,” completing one bounded slice is a checkpoint, not a terminal condition. After verification, self-review, commit, handoff, and status refresh, immediately select and begin the next dependency-ready bounded slice.

Do not end merely because a task passed, a commit was created, a handoff was written, or a convenient response boundary was reached. End continuous execution only when the requested outcome is complete, the human supplies a limit or stop instruction, a hard stop requires approval, a real dependency/blocker prevents meaningful progress, or a material product/policy choice requires human direction. Ordinary uncertainty should be resolved from repository sources and safe, reversible assumptions.

`docs/status/PROJECT_STATUS.md` is the central progress index. Task files and handoffs remain the detailed evidence; the status index must link to them rather than replacing them. Never report guessed percentages as verified completion.
