# Task: Enforceable headed-browser verification guard

- Status: Complete
- Owner/agent: Cline
- Branch: `agent/browser-verify-guard`
- Risk: Low
- Related epic: E0 — Repository & engineering foundation (Stage 2 release discipline)
- Related ADRs: None (no business/architecture change; enforcement only)

## Objective

Turn the previously prose-only rule — "any browser-facing change must be
verified in a real, headed browser with a human-like full-flow click-through" —
into a machine-enforced gate that fails `npm run verify` when a UI-browsable
slice has no committed headed-browser evidence.

## Source-of-truth references

- `AGENTS.md` (engineering rules, mandatory invariants, hard stops)
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md` (Stage 2 release discipline)
- `docs/brain/testing.md`

## Scope

- `scripts/browser-verify-guard.mjs`: deterministic gate; detects UI changes and
  validates committed evidence.
- `scripts/browser-verify-evidence.mjs`: shared evidence schema + writer.
- `scripts/browser-verify-guard.test.mjs`: unit coverage of the gate helpers.
- `--evidence` flag on the three browser e2e scripts.
- `package.json`: `ui-guard` script wired into `verify` and `verify:ci`.
- `scripts/e0-check.mjs`: non-regression registration of the guard artifacts.
- `docs/verify/README.md`: evidence convention/schema doc.
- `AGENTS.md` + `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`: unambiguous rules.

## Non-scope

- No production deploy, migration, credential, or business-logic change.

## Domain invariants affected

None modified. The guard only adds a verification checkpoint; it cannot weaken
any existing invariant.

## Acceptance criteria

- [x] `npm run verify` fails when a UI file under `apps/web`/`apps/admin` is
      changed with no valid `docs/verify/browser-verify.json`.
- [x] The gate requires `headed === true`, `result === "passed"`, and non-empty
      `scope`/`tool`/`businessFlow.subject`/`businessFlow.steps`.
- [x] Non-UI slices pass the gate (no false positives).
- [x] Removing the guard file/missing conventions fails `verify:e0`.

## State/API/schema/UI impact

No production state, API, schema, or UI change. Adds one local verification
artifact schema (`docs/verify/browser-verify.json`).

## Security and privacy review

No sensitive surface. The evidence file carries no credentials. The gate runs on
committed diff/status only and performs no network access.

## Test plan

- Unit: `scripts/browser-verify-guard.test.mjs`
- Full gate: `npm run verify` (passes; this slice touches no UI source)

## Migration and rollback

`None`.

## Prohibited changes / hard stops

`None` triggered; production deployment and core invariants remain hard stops.
