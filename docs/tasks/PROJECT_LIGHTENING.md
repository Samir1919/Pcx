# Task: Project Lightening (Token-Burden Reduction)

- Status: In progress
- Owner/agent: Cline
- Branch: `agent/project-lightening`
- Risk: Medium
- Related epic: E0 — Repository & engineering foundation
- Related ADRs: 0001 (modular monolith), 0002 (PG source of truth)

## Objective

Reduce unnecessary token/context burden while keeping the project fully functional and industry-standard: archive stale docs, dedup agent adapters, delete unused package stubs, consolidate admin API clients, and normalize domain imports.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/specifications/` (kept intact)

## Scope

- Move non-active handoffs/tasks into `docs/archive/`.
- Slim duplicate agent-adapter files to canonical pointers.
- Delete unused `packages/config`, `packages/testing`, `packages/ui`.
- Consolidate `apps/admin/lib/*-api.js` around `api-client.js`.
- Normalize `packages/domain` deep-relative imports to `@pcx/domain/*`.

## Non-scope

- No source-of-truth specs/ADRs deletion.
- No business logic / invariant changes.
- No production deploy, destructive migration, secret change.
- No `.next`/build-output cleanup (not tracked, not token burden).

## Domain invariants affected

- None changed. All domain invariants remain server-enforced.

## Acceptance criteria

- [ ] `npm run verify` passes.
- [ ] `npm run web:check` passes for admin/web UI (since admin lib touched).
- [ ] Unused package stubs are deleted with no dangling references.
- [ ] All admin API call sites still function.

## Test plan

- Unit: `npm test`
- Full gate: `npm run verify`
- Browser: `npm run web:check`

## Migration and rollback

None. File moves are reversible via git history.

## Prohibited changes / hard stops

- Do not delete `docs/specifications/` or `docs/adr/`.
- Do not weaken `AGENTS.md` canonical rules.
- Do not change tests to hide regressions.
