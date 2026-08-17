# Task: CLINE_AUDIT_FIX_09 — Worker tick errors are never swallowed

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (observability)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Stop silently discarding worker tick exceptions. Default `onError` now logs via
`console.error`, and the runtime wiring passes it explicitly.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #9

## Scope

- `apps/worker/src/worker.mjs`: default `onError = console.error`.
- `apps/worker/src/main.mjs`: pass `onError: console.error`.
- `apps/worker/test/worker.test.mjs`: assert default logs instead of swallowing.

## Non-scope

- No auto-restart behavior (left to process manager).

## Domain invariants affected

None.

## Acceptance criteria

- [x] Default onError logs tick errors.
- [x] Explicit onError still honored.

## State/API/schema/UI impact

None.

## Security and privacy review

No new exposure.

## Test plan

- Unit: `apps/worker/test/worker.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
