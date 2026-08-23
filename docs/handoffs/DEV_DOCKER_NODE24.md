# Agent Handoff: Dev Docker-first + Node 24 LTS alignment + Scheduled backlog

- Status: Complete
- Branch: `agent/dev-docker-node24`
- Latest commit: `40204ab`

## Outcome

1. **Backlog scheduled** — G/H/I/J follow-up slices recorded in
   `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`, linked from `PROJECT_STATUS.md`.

2. **Dev is now Docker-first** — `infra/docker-compose.yml` runs the full app
   stack (api, web, admin, worker, migrate) plus Postgres/Redis/MinIO.
   `scripts/dev.mjs` drives it; `--host` is a diagnostics-only fallback.

3. **Node 24 LTS alignment** — all four Dockerfiles pinned to
   `node:24.19.0-alpine`, `.nvmrc` = 24, root `engines` = `>=24 <25`.

4. **Runtime fix** — `@pcx/domain` declared in `apps/api` and `apps/worker`
   dependencies (host dev only worked because workspaces symlink; container
   `npm ci --workspace` did not link it). Regenerated package-lock.

## Verification (all green)

| Check | Result |
|---|---|
| docker compose config (dev) | valid |
| docker compose build api/worker/web/admin (Node 24) | pass |
| runtime smoke | api `/health/ready` ready, web 200, admin 200, worker "running" |
| `node scripts/admin-e2e-check.mjs` | 26/26 (Docker-hosted apps) |
| `npm run verify:e0` | 33 artifacts |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | 543 pass / 0 fail |
| `npm run test:integration` | 26 pass / 0 fail |
| `npm run security` | pass |

## Notes / hard stops

- No production deployment, no real secrets, no destructive migration.
- Host Node is still 26; that is now irrelevant for dev (apps run in Node 24
  containers). `.nvmrc` = 24 for any future host work.
- Real provider credentials/domain/deploy remain human hard stops.
