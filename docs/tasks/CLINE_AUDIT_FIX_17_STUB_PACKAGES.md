# Task: CLINE_AUDIT_FIX_17 — Populate dead stub packages

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: ADR-0004 (packages/ui deferred); INFRASTRUCTURE_DEVOPS.md

## Objective

Give the three stub packages real `src/index.mjs` + `exports` so they are usable
and no longer dead one-line package.json files.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #17
- `docs/specifications/INFRASTRUCTURE_DEVOPS.md` (packages intent)
- ADR-0004 (packages/ui deferred until reuse is evidenced)

## Scope

- `packages/config`, `packages/testing`, `packages/ui`: add minimal
  `src/index.mjs` and `main`/`exports`.

## Non-scope

- No consumers added; packages remain ready for future reuse.

## Acceptance criteria

- [x] All three packages are importable via their package names.

## Verification

- `node --input-type=module -e` import check: config/testing/ui all resolve.
- `npm test`: 338 pass, 22 skip, 0 fail.
- `npm run verify:e0`: 36 artifacts verified.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
