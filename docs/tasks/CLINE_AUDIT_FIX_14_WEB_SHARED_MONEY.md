# Task: CLINE_AUDIT_FIX_14 — Extract shared money() formatter

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (UI)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Extract the duplicate currency formatter into `apps/web/lib/format.js` and import
it in both storefront and passport pages.

## Scope

- `apps/web/lib/format.js` (new), `apps/web/app/storefront/workspace.js`,
  `apps/web/app/passport/[pcxId]/page.js`.

## Non-scope

- None.

## Acceptance criteria

- [x] Single shared `money()` used in both pages.

## Test plan

- Full gate: `npm test`.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
