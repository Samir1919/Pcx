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

## Continuation semantics

An open-ended human instruction to continue dependency-ready work persists across task, branch, commit, handoff, and chat-response boundaries. For that instruction, use this outer loop:

```text
Select next dependency-ready bounded slice
→ execute and verify the standard loop
→ commit, hand off, and refresh project status
→ immediately select the next dependency-ready bounded slice
```

A completed slice is evidence and a checkpoint, not permission to stop. The outer loop ends only when the human’s terminal outcome is achieved, the human sets a limit or stops the run, a hard stop needs approval, no meaningful dependency-ready work remains because of a genuine blocker, or a material product/policy decision cannot be resolved from approved sources. Lack of a separate orchestrator, completion of required checks, creation of a commit, or creation of a handoff is not a blocker.

## Branch and commit rules

- Use one isolated branch per epic or coherent slice: `agent/<short-description>`.
- Never rewrite shared published history.
- Keep commits small and purposeful; include the epic/slice intent.
- Never stage unrelated user work.
- Do not merge or deploy merely because tests pass; follow human and repository gates.

### Safe commit creation in the control plane

The Stage 3 control plane (`scripts/control-plane.mjs`) exposes a `createShellGit().commit({ message, files })` method that creates commits without risking a shell hang. Use it for any commit made through the control plane:

- It **rejects any message containing a newline** (fail-fast) instead of hanging on a `dquote>` continuation prompt. A multi-line `-m` argument is the most common cause of a stuck agent terminal.
- When `files` are provided, it stages them first (`git add <files>`) and then commits with a single-line `-m`.
- All commands run through `execFile` with explicit argument arrays (no shell interpolation).

For a multi-line commit message, write the message to a file first and commit with `git commit -F <file>` (see "Shell command safety" below). Never pass a multi-line string as a `-m` argument.


## Shell command safety

Agent terminals run non-interactively. A command that waits for input never returns; the run stalls silently and the agent appears "stuck" while nothing is actually executing. These rules are mandatory for every tool.

**Never put a multi-line string inside a shell command.** A `-m "line one<newline>line two"` argument is the most common cause: the newline reaches the shell before the closing quote, the shell drops to a `dquote>` continuation prompt, and the command hangs forever. Nothing is staged, nothing is committed, and there is no error to read.

For a multi-paragraph commit message, write the message to a file first, then:

```bash
git commit -F docs/handoffs/.commit-msg.txt
```

Or keep every argument on a single line with one `-m` per paragraph:

```bash
git commit -m "feat(scope): single-line subject" -m "Single-line body paragraph."
```

Additional rules:

- Prefer many short commands over one long chained command. A chain that hangs gives no signal about which step stalled.
- Pass non-interactive flags explicitly: `git --no-pager`, `npm ci --no-audit --no-fund`, `gh --json`. Never rely on a pager exiting on its own.
- Do not pipe a long-running command through `tail`/`head` when you need progress; the output is buffered until the command finishes, so a hang and a slow success look identical.
- Never run a command that opens an editor or prompts for a password, a passphrase, or a `y/n` confirmation. Use the flag that answers it, or stop and ask the human.

If a command appears to hang, verify the real state before retrying or reporting anything: `git status --short`, `git log --oneline -3`, and `ls .git/index.lock`. An empty staging area and an unchanged `HEAD` mean the command never ran — do not describe the work as committed.

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
