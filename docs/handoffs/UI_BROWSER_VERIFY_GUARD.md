# Agent Handoff: Enforceable headed-browser verification guard

- Status: Complete (pending commit/merge)
- Branch: `agent/browser-verify-guard`
- Latest commit: (to be created)
- Date: 2026-08-25

## Outcome

The rule "any browser-facing change must be verified in a real, headed browser
with a human-like, start-to-end full-flow click-through" is now an enforced
gate. `npm run ui-guard` (wired into `npm run verify` and `npm run verify:ci`)
detects UI changes under `apps/web`/`apps/admin` and fails unless a valid
`docs/verify/browser-verify.json` exists with `headed === true`,
`result === "passed"`, and a non-empty `businessFlow` (subject + steps).

## Changed areas

- `scripts/browser-verify-guard.mjs` — deterministic gate; pure helpers exported
  for tests, top-level run only when executed directly.
- `scripts/browser-verify-evidence.mjs` — shared evidence schema + writer/reader.
- `scripts/browser-verify-guard.test.mjs` — 7 unit tests.
- `scripts/business-e2e-check.mjs`, `scripts/admin-e2e-check.mjs`,
  `scripts/storefront-e2e-check.mjs` — added `--evidence` export writing the
  record automatically after a run.
- `package.json` — added `ui-guard` and chained it into `verify` and `verify:ci`.
- `scripts/e0-check.mjs` — guard files + convention doc registered as required
  artifacts (non-regression: deleting the guard fails `verify:e0`).
- `docs/verify/README.md` — evidence convention/schema (new).
- `AGENTS.md`, `docs/agentic/PORTABLE_AGENT_WORKFLOW.md` — rule made unambiguous.
- `docs/tasks/UI_BROWSER_VERIFY_GUARD.md` — bounded task record.

## Acceptance criteria

- [x] UI change without evidence fails the gate (verified: probe file triggered
      exit 1 with actionable message).
- [x] Headed/passed/scope/tool/subject/steps all required (unit-tested).
- [x] Non-UI slice passes (this slice: `npm run verify` green).
- [x] Missing guard artifacts fail `verify:e0`.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/browser-verify-guard.test.mjs` | Pass (7/7) |
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm run lint` | Pass |
| `npm run ui-guard` (UI probe) | Fail as expected (exit 1) |
| `npm run verify` | Pass (568 tests, 0 fail) |

## Architecture/security review

No business/architecture change. Enforcement-only checkpoint; no new authority
for agents (it narrows what can be reported as done). No credentials in evidence.
No ADR required: this formalizes an existing Stage 2 control.

## Schema/configuration/deployment

`None`. No migrations, env vars, or deploy impact. New local artifact
`docs/verify/browser-verify.json` (committed per UI slice).

## Remaining work and next safe action

1. Commit and merge this slice; run `node scripts/merge-gate.mjs`.
2. On the next actual UI slice, exercise one e2e script with
   `PCX_HEADED=1 ... --evidence` to confirm the full realistic flow.

## Blockers requiring human decision

`None`.
