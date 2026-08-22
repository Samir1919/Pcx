# Handoff: Project Lightening (Token-Burden Reduction)

- Branch: `agent/project-lightening`
- Commits: `367a809`, `1abc07c`
- Task: `docs/tasks/PROJECT_LIGHTENING.md`
- Risk: Medium (docs relocation + unused package deletion + server-side import normalization)

## Objective

Reduce unnecessary token/context burden while keeping the project fully functional and industry-standard.

## Completed scope

1. **Docs archive** — Moved 134 `docs/handoffs/` and 98 `docs/tasks/` files into `docs/archive/` (git rename, history preserved). Active working surface now holds only the single active task file. Updated internal references that pointed at `docs/handoffs/...`, `docs/tasks/...`:
   - `docs/adr/0008-stage3-entry-evidence.md` → now points at `docs/archive/handoffs/STAGE3_WORKTREE_CONFLICT_PLANNING.md`.
   - `docs/status/PROJECT_STATUS.md` → latest-evidence line updated to `docs/archive/handoffs/...` plus an archive note in the update rule.

2. **Unused package stubs deleted** — `packages/config`, `packages/testing`, `packages/ui` removed (no importer anywhere; only `package-lock.json` self-references). `package-lock.json` regenerated with `npm install`. `scripts/e0-check.mjs` required-artifact list updated (33 artifacts now, down from 36). `packages/domain` retained (the real business domain).

3. **Domain import normalization** — 43 server-side files under `apps/api` (28 modules + 15 tests) converted from deep-relative `.../packages/domain/src/...` imports to the canonical `@pcx/domain` package import. Zero deep-relative domain imports remain.

## Evaluated but intentionally deferred (no unnecessary deletion / no token win)

- **Agent adapters (`CLAUDE.md`, `GEMINI.md`, `CONVENTIONS.md`, `.cursor`, `.roo`, `.github/copilot-instructions.md`)** — already 1–8 line canonical pointers (33 lines total). No duplication to remove; `AGENTS.md` remains the single source of truth. Untracked `.continue/` and `.playwright-mcp/` are `.gitignore`-d local tool config, not repo token burden.
- **Admin `apps/admin/lib/*-api.js` (16 files, 370 LOC)** — every file has active importers (no dead code). Consolidating them would be a cosmetic lateral move with browser-regression risk and negligible token reduction, so left as-is under functional-parity-first.

## Verification

- `npm run verify:e0` → `E0 verified: 33 required artifacts` (exit 0)
- `npm run lint` → Lint policy check passed
- `npm run typecheck` → Domain contract check passed
- `npm test` → 526 total, 500 pass, 0 fail, 26 skipped
- `npm run build` → Application boundaries load successfully
- `npm run security` → Security scan passed (secrets + dependencies + container)
- No `apps/web` / `apps/admin` browser-facing code changed, so `web:check` was not required for this slice.

## Non-scope / hard stops observed

- No `docs/specifications/` or `docs/adr/` deletion.
- No business logic, domain invariant, or schema change.
- No production deploy, destructive migration, secret/credential change.
- No test weakening.

## Decisions / ADRs

- Reversible archive-via-`git mv` chosen over deletion to keep durable history (consistent with AGENTS.md portable completion record).
- No ADR required: this is a structural cleanup, not a business-truth change.

## Risks

- Docs links external to the repo (chat history, wiki) may still reference old `docs/handoffs/...` paths; Git history is the recovery path.
- Low: agent tooling that unconditionally walks `docs/handoffs/` may now find it empty; repository indexes point to `docs/archive/`.

## Next safe task

- None required for this objective. Optional future work: consolidate admin `*-api.js` only when a real reduction (e.g. removing a genuinely unused client) is evidenced.
