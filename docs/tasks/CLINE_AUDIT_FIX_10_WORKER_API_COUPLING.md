# Task: CLINE_AUDIT_FIX_10 — Fail-fast smoke test for worker→API internals

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (architecture guard)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Add a fail-fast smoke test so any future refactor of `apps/api`'s internal layout
(moving/renaming the shipment/notification services/repositories the worker
imports by relative path) breaks loudly at import time instead of silently at
runtime.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #10

## Scope

- Add `apps/worker/test/api-coupling.test.mjs` asserting the four coupled modules
  remain importable and export the expected constructors.

## Non-scope

- Moving the shared services into a package (the bounded smoke-test option was
  chosen; a package move is a separate architectural decision).

## Domain invariants affected

None.

## Acceptance criteria

- [x] Coupled modules are importable and export the expected contracts.

## State/API/schema/UI impact

None.

## Security and privacy review

No new exposure.

## Test plan

- Unit: `apps/worker/test/api-coupling.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
