# Task: CLINE_AUDIT_FIX_13 — Remove dead /catalog nav links in apps/web

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (UI)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Remove the dead `/catalog` nav link from the two apps/web pages so clicking it
no longer 404s (that route only exists in apps/admin).

## Scope

- `apps/web/app/storefront/workspace.js`, `apps/web/app/passport/[pcxId]/page.js`.

## Non-scope

- No route addition.

## Acceptance criteria

- [x] No `href="/catalog"` remains in apps/web.

## Test plan

- Full gate: `npm test`.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
