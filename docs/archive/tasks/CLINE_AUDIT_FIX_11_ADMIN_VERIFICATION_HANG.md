# Task: CLINE_AUDIT_FIX_11 — Admin verification page never hangs

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (UI correctness)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Prevent the admin verification page from being stuck on "Loading templates…"
when the categories fetch fails or returns an empty list.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #11

## Scope

- `apps/admin/app/(workspace)/verification/page.js`: clear loading and show an
  error on categories fetch failure; resolve to non-loading on empty categories;
  make `load()` always leave a resolved state.

## Non-scope

- No API/backend changes.

## Domain invariants affected

None.

## Acceptance criteria

- [x] Categories failure clears loading and surfaces an error.
- [x] Empty categories resolves to a non-loading state.

## State/API/schema/UI impact

UI only.

## Security and privacy review

No new exposure.

## Test plan

- No dedicated page test; full gate `npm test` (338 pass, 22 skip, 0 fail).

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
