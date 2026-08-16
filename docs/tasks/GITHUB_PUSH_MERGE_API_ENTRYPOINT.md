# Task: Push and merge API entrypoint fix

- Status: Complete
- Owner/agent: PCX agent
- Branch: `agent/api-entrypoint-fix`
- Risk: Low
- Related epic: E0 — Repository & engineering foundation
- Related ADRs: None

## Objective

Commit the approved API development entrypoint fix, push it to GitHub on an isolated branch, and merge it into `main` through the repository remote.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`
- `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`

## Scope

- Include `apps/api/src/index.mjs` as the runnable database-backed API entrypoint.
- Update the root `dev:api` script to use that entrypoint.
- Push the isolated branch and merge it into `main` on GitHub.

## Non-scope

- Do not commit `.continue/agents/*`.
- Do not deploy to production or change credentials, payment destinations, migrations, or core invariants.

## Domain invariants affected

- None; this changes local API composition only.

## Acceptance criteria

- [x] Relevant verification passes.
- [x] Approved files are committed on an isolated branch.
- [x] Branch is pushed to GitHub.
- [x] Changes are merged into `main`.
- [x] `.continue/agents/*` remains uncommitted.

## State/API/schema/UI impact

No API contract, schema, or UI behavior change. The local API process now starts with database-backed runtime composition.

## Security and privacy review

No new credentials or external destinations are introduced. The local delivery adapter is a no-op and the database connection uses the existing environment-variable/default configuration.

## Test plan

- Unit/regression: `npm test`
- Repository gate: `npm run verify:e0`
- Full gate: `npm run verify`

## Migration and rollback

None. Rollback is a revert of the merge commit if needed.

## Prohibited changes / hard stops

No production deployment, destructive migration, secret change, payment-provider change, test/security weakening, or direct commit of unrelated untracked files.
