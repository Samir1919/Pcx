# Agent Handoff: Safe Commit Method in the Shell Git Adapter

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: `d1f02c3` (control-plane code and tests); the documentation slice
  (`AGENTS.md`, `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`) landed in the
  payment-provider-config commit on the same branch.
- Date: 2026-08-17

## Outcome

The Stage 3 control plane's real shell git adapter (`createShellGit` in `scripts/control-plane.mjs`) now exposes a `commit({ message, files })` method that creates commits without risking a shell hang. It rejects any message containing a newline (fail-fast) instead of hanging on a `dquote>` continuation prompt, stages provided files first, and runs all commands through `execFile` with explicit argument arrays (no shell interpolation). The portable agent workflow guide now documents this safe commit path.

## Changed areas

- `scripts/control-plane.mjs` — added `commit` to the `createShellGit` adapter and to the returned frozen object. Validates `message` (non-empty, single-line) and `files` (array of repository-relative, traversal-safe paths). Stages files with `git add <files>` when provided, then commits with `git commit -m <message>`.
- `scripts/control-plane.test.mjs` — extended the existing shell git adapter test to cover `commit`, and added two dedicated tests: multi-line message rejection (no run invoked) and file staging before commit (plus traversal rejection).
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md` — added a "Safe commit creation in the control plane" subsection under "Branch and commit rules" documenting the new method and the multi-line `-F <file>` guidance.
- `AGENTS.md` — added the engineering rule forbidding multi-line strings inside shell commands, pointing at the workflow guide.

## Acceptance criteria

- [x] `createShellGit().commit({ message })` runs `git commit -m <message>` and returns `{ ok: true }` on success.
- [x] `createShellGit().commit({ message, files })` stages files first (`git add <files>`) then commits.
- [x] A multi-line message is rejected with a clear error and no git command is invoked (prevents the shell hang).
- [x] File paths are validated as repository-relative without traversal.
- [x] All commands run through the injected `run` (execFile) with explicit argument arrays; no shell interpolation.
- [x] Tests added and passing; full verification gates green.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/control-plane.test.mjs` | Pass — 41 tests, 0 fail |
| `npm run verify:e0` | Pass — 36 required artifacts |
| `npm test` | Pass — 315 pass, 0 fail, 22 skipped (DB integration) |
| `git diff --check` (changed files) | Clean |

## Architecture/security review

- No new invariants changed; this is an additive capability on the existing shell git adapter.
- The multi-line rejection is a fail-fast guard against the most common cause of a stuck agent terminal (a `-m` argument containing a newline dropping the shell into a `dquote>` continuation prompt). Multi-line messages must be written to a file and committed with `git commit -F <file>`.
- File paths are normalized and validated as repository-relative without traversal, consistent with the existing `normalizeRepositoryPath` policy.
- No secrets, credentials, or production data are involved. No ADR change required (ADR 0007 vendor-neutral executor contract is unaffected).

## Schema/configuration/deployment

None. No migrations, environment variables, or deployment changes.

## Remaining work and next safe action

1. Wire the worker into the deployment runtime (docker-compose) for the courier webhook outbox.
2. Link the `/payments` admin route from the sidebar and implement a real bKash HTTP adapter behind the injected gateway contract.
3. Continue Stage 3 control-plane hardening as defined in `docs/tasks/AUTONOMOUS_SAFE_SLICES.md`.

## Blockers requiring human decision

None. Production deployment and real provider credentials remain human-approval hard stops.
