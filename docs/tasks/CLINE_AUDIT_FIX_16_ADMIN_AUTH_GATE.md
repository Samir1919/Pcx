# Task: CLINE_AUDIT_FIX_16 — Central admin auth gate

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Medium (auth/security)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Gate the privileged admin shell on `identity`/`loading` from `AuthProvider` and
redirect unauthenticated users centrally instead of relying on per-page 401
banners.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #16

## Scope

- `apps/admin/app/user-shell.js`: consume `loading`; show a loading state until
  identity resolves; redirect to `/login` when unauthenticated; render `null`
  while redirecting.

## Non-scope

- Per-page 401 banners remain as harmless fallbacks (now unreachable for the
  unauthenticated case since the redirect happens first).

## Domain invariants affected

- "State transitions and authorization are enforced on the server" (unchanged).
  This is client-side UX gating only; the server remains authoritative.

## Acceptance criteria

- [x] Shell consumes `loading` and shows a loading state.
- [x] Unauthenticated users redirect to `/login` centrally.

## Test plan

- Full gate: `npm test`.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
