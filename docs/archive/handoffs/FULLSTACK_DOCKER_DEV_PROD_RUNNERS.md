# Agent Handoff: Full-stack Docker packaging + one-command dev/prod runners

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: Pending (merge commit filled by the next status-only update)
- Date: 2026-08-17

## Outcome

The entire platform can now run with a single command in both development and production, reusing the same Dockerfiles so there is one build path and no repeated per-environment work.

- Development: `npm run dev` brings up infra containers, runs migrations, and starts api + web + admin + worker with prefixed logs; Ctrl+C stops everything.
- Production: `npm run prod:build` / `prod:up` / `prod:down` / `deploy` drive a standalone `pcx-prod` compose project (api + web + admin + worker + one-shot migrate + Caddy proxy) with infra internal-only and the proxy as the only public entrypoint.

## Changed areas

- `scripts/dev.mjs` (new) — one-command local dev runner (infra up → migrate → 4 services, prefixed logs, clean SIGINT/SIGTERM shutdown).
- `scripts/prod.mjs` (new) — production build/up/down/deploy runner using an explicit `--env-file` (`infra/.env`, falling back to `infra/.env.example`) so it never inherits the dev root `.env`.
- `apps/api/Dockerfile` (new) — multi-stage Node 22 image; installs `pg` + native `argon2` with build tools, strips them, runs as non-root.
- `apps/web/Dockerfile` (new) — Next.js `standalone` build → minimal runner; `ARG PCX_API_ORIGIN` baked into the build-time rewrites.
- `apps/admin/Dockerfile` (new) — same shape as web but `PORT=3001`.
- `infra/docker-compose.prod.yml` (new) — standalone full-stack prod compose (project `pcx-prod`), infra internal-only, proxy external-only.
- `infra/Caddyfile` (new) — local HTTP reverse proxy for web/admin.
- `infra/.env.example` (new) — placeholder prod environment.
- `package.json` — added `dev`, `dev:web`, `dev:admin`, `prod:build`, `prod:up`, `prod:down`, `deploy`.
- `README.md` — full rewrite with prerequisites, dev/prod quick starts, command reference, environment-variable table, secrets & hard stops, layout, and quality gates.
- `docs/status/PROJECT_STATUS.md` — noted the full-stack Docker packaging and runner evidence.

## Acceptance criteria

- [x] `npm run dev` single command starts the full local stack.
- [x] `npm run prod:up` single command starts the full production stack (migrate-first, infra internal-only).
- [x] api/web/admin/worker all build as non-root Node 22 images.
- [x] Full-stack production smoke test passes (API health 200; web/admin via proxy 200).
- [x] No production deployment, no real secrets, no hard stop violated.
- [x] `verify:e0` and `npm test` pass.

## Verification

| Command/test | Result |
|---|---|
| `docker compose ... build api` | Pass (argon2 native build, image `pcx-api`) |
| `docker compose ... build web admin` | Pass (standalone Next.js runners) |
| API smoke (`/health/live`, `/health/ready`) | 200 / 200 |
| `node scripts/prod.mjs up --build` | Pass: migrate completed, api healthy, worker/web/admin/proxy started |
| `curl http://127.0.0.1:8080/` (web via Caddy) | 200 (after redirect) |
| `curl http://127.0.0.1:8081/` (admin via Caddy) | 200 (after redirect) |
| `node scripts/prod.mjs down` | Pass (clean teardown) |
| `npm run verify:e0` | Pass: 36 required artifacts |
| `npm test` | Pass: 343 total; 321 passed; 22 PostgreSQL integration skips by design; 0 failed |

## Architecture/security review

No PCX commerce invariant or source-of-truth rule changed. Dockerfiles run as a non-root `node` user and copy only per-app sources. Build args and environment values are validated and flow through `execFile`-style compose commands without shell interpolation. The production compose keeps PostgreSQL/Redis/MinIO internal-only and exposes only the reverse proxy. Secrets are never committed: `infra/.env` and the root `.env` are git-ignored; only `infra/.env.example` is tracked. The `deploy` command is a runbook only.

## Schema/configuration/deployment

No database migration or data model change. New config: `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `infra/.env.example`, three app Dockerfiles, and the dev/prod runner scripts. Production deployment, real domains/TLS, and real credentials remain hard stops.

## Remaining work and next safe action

1. Install/authenticate a real container scanner (docker scout login or trivy) to produce an actual image vulnerability report.
2. Implement a real bKash HTTP adapter behind the injected gateway contract (sandbox-only until real credentials are approved).
3. Production deployment and real provider credentials remain human-approval hard stops.

## Blockers requiring human decision

None for this slice. Production deployment, real domains/TLS, and real credentials are hard stops requiring explicit human approval.
