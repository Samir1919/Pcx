# Task: CLINE_AUDIT_FIX_15 — Add frontend error boundaries

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (UI resilience)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Add minimal retry error boundaries so an uncaught client-component exception shows
app context instead of a blank page/generic overlay.

## Scope

- `apps/admin/app/(workspace)/error.js`, `apps/web/app/error.js`.

## Non-scope

- No `global-error.js` (not required by the audit fix list).

## Acceptance criteria

- [x] Both apps have a retry-able error boundary.

## Test plan

- Full gate: `npm test`.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
