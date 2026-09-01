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
- UI and product flows must follow industry-standard patterns: before implementing a feature, research how established software companies and business organizations build the equivalent flow (reference implementations, leading SaaS/commerce/admin products, and established UX conventions), then implement to that researched benchmark — never a guessed or "minimal" surface. Cite the reference in the task/handoff. This applies to the backend API shape, the admin UI, and the customer web UI alike (e.g. an ecommerce product detail view uses a large main image with a thumbnail gallery and full specifications; an admin list shows human-readable product/condition/status, never raw UUIDs). Never ship a placeholder or minimal surface where a researched standard exists.
- Full-stack logic continuation: a business rule, server-owned fact, or state transition must be implemented consistently across the server (domain/service/repository/HTTP), the admin UI, and the customer web UI. Never ship a rule that exists only in the backend while its admin or web surface is missing, hardcoded, or client-authoritative. Server-owned values (price, totals, role, status, grade, warranty/expiry windows) must be rendered read-only from server data on every surface that shows them — never re-typed or re-derived in the UI. A slice is not complete until the rule is correct on all three surfaces.
- All UI CSS must be dynamic and responsive per `docs/guidelines/UI_STYLE_GUIDE.md`: every design value lives in a `:root` token and is consumed via `var(--…)` (colors, spacing, radii, `--touch-target`, rem-based breakpoints), fluid type/spacing via `clamp()`, fluid grid via `auto-fit/minmax`, mobile-first rules, and no hardcoded magic numbers (no fixed pixel width, no hardcoded palette hex, no hardcoded `44px`). Verify no horizontal overflow across the 320/375/768/1024px viewport matrix.
- Multi-field input uses a real form: when a flow collects or edits more than one field, use a labeled `<form>` submitted to the server — not free-typed IDs/values in row actions. Single-field row actions are acceptable; multi-field data entry is always a form.
- Any change to a browser-facing page or flow (`apps/web`, `apps/admin`) must be verified with a real browser before it is reported as done; code review and `curl` are not acceptable substitutes. When the changed surface is UI-browsable, the slice must leave committed headed-browser evidence (`docs/verify/browser-verify.json`, schema in `docs/verify/README.md`): a human-like, start-to-end click-through of the full business flow for the changed surface, run headed (`PCX_HEADED=1` with a `*--e2e-check.mjs --evidence`, or the Playwright MCP tool headed — never headless). `npm run ui-guard` enforces this inside `npm run verify`: a UI-browsable slice without valid headed evidence fails the gate. If the tooling is missing, ask the human before installing/configuring it.
- Run `npm run verify:e0`, `npm test`, and relevant checks before commit.
- After a successful commit, push and merge into `main` (or open/merge a PR) as part of the same slice — a slice is NOT complete while its work remains on an unmerged feature branch. Verify with `node scripts/merge-gate.mjs`; it must report `OK: ... is merged into origin/main` (exit 0). `git push` alone on a feature branch is insufficient.
- Never leave unresolved merge-conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in a tracked file. The `npm run lint` gate fails if any exist, so run it before every commit.
- Never commit credentials, production data, or private evidence.
- Never put a multi-line string inside a shell command. Write commit bodies to a file and use `git commit -F <file>`. See "Shell command safety" in `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`.
- Record approved architecture changes as ADRs; do not silently change business truth.
- When a task or slice completes successfully (checks pass and the change is committed), run `git push` immediately. Always `git push` after a successful commit or merge; never leave completed, committed, or merged work unpushed. If a commit or merge fails, fix it first, then push.

## Human-like verification checklist

When the human asks to verify "like a human" — or to verify any completed slice — run this consolidated checklist top to bottom and report every line as PASS / FAIL / N/A with exact evidence (file, selector, screenshot, or command output). It merges the standing invariants, engineering rules, and UI style guide into one definition-of-done; a vague "looks fine" is not evidence.

For the complete A→Z verification flow (all APIs, all admin sections/subsections, all customer-web functions, gap analysis, and the resilience protocol), follow `docs/verify/FULLSTACK_VERIFICATION_PLAYBOOK.md`.

1. Logic continuation (server ↔ admin ↔ web):
   - [ ] Every business rule/state transition in scope is enforced on the server (domain/service/repository/HTTP), not only in the UI.
   - [ ] The same rule is surfaced correctly in BOTH the admin UI and the customer web UI where applicable.
   - [ ] No surface is missing, hardcoded, or re-derives a server-owned value (price, totals, role, status, grade, warranty/expiry window).
   - [ ] No UI re-types a value the server already computes (refund amount, COD amount, shipping charge, offer expiry, warranty window).

2. Domain invariants:
   - [ ] Unique lifecycle identity, no double-sell, idempotent payment/refund/acquisition, server-enforced state/authorization, and public-passport privacy all remain protected.

3. Industry-standard patterns (researched, not guessed):
   - [ ] The flow matches how established products build the same feature; the reference is cited in the task/handoff.
   - [ ] No placeholder or minimal surface where a researched standard exists.
   - [ ] Loading, empty, error, conflict, and recovery states are all present (no fake success).

4. Dynamic + responsive CSS:
   - [ ] Every value via a `:root` token + `var(--…)` (colors/spacing/radii/`--touch-target`/rem breakpoints) — no magic numbers, no hardcoded `44px`, no fixed pixel width, no hardcoded hex outside `:root`.
   - [ ] Fluid type/spacing with `clamp()`; fluid grid with `auto-fit/minmax`; mobile-first rules.
   - [ ] No horizontal overflow across the 320/375/768/1024px viewport matrix.
   - [ ] Touch targets use `var(--touch-target)`; `:focus-visible` and `prefers-reduced-motion` preserved.

5. Forms for multi-field input:
   - [ ] Multi-field entry/edit uses a labeled `<form>` submitted to the server.
   - [ ] No free-typed IDs/values in row actions for multi-field flows; every control has a visible label.

6. Theme / visual consistency:
   - [ ] Reuses the app's single stylesheet tokens and component patterns (buttons, banners, cards, modals, tables).
   - [ ] Verified by looking at the rendered result in a real browser — not `evaluate()` numbers alone.

7. Headed-browser click-through:
   - [ ] Full start-to-end business flow exercised in a headed browser.
   - [ ] `docs/verify/browser-verify.json` present with `headed: true` and `result: "passed"` (UI-browsable slices).
   - [ ] No `console.error`, uncaught exceptions, or failed API requests during the flow.

8. Gates:
   - [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify` all pass.

## Hard stops

Stop for explicit human approval before production deployment, destructive/irreversible migration, production/customer-data deletion, payment destination or provider credential changes, production secret rotation, disabling tests/security controls, large framework replacement, or changing a core invariant/source-of-truth.

## Portable completion record

Every material agent run must leave enough durable context for a different agent to continue without chat history: task scope, acceptance criteria, changed files, tests/results, decisions/ADRs, risks, blockers, branch, and latest commit. Use `docs/agentic/HANDOFF_TEMPLATE.md`.

## Continuous-execution contract

When the human gives an open continuation instruction such as “continue,” “take the next dependency-ready task,” “finish the MVP,” or “do not stop,” completing one bounded slice is a checkpoint, not a terminal condition. After verification, self-review, commit, handoff, and status refresh, immediately select and begin the next dependency-ready bounded slice.

Do not end merely because a task passed, a commit was created, a handoff was written, or a convenient response boundary was reached. End continuous execution only when the requested outcome is complete, the human supplies a limit or stop instruction, a hard stop requires approval, a real dependency/blocker prevents meaningful progress, or a material product/policy choice requires human direction. Ordinary uncertainty should be resolved from repository sources and safe, reversible assumptions.

`docs/status/PROJECT_STATUS.md` is the central progress index. Task files and handoffs remain the detailed evidence; the status index must link to them rather than replacing them. Never report guessed percentages as verified completion.
