# PCX

PCX is a verified used-tech recommerce platform for Bangladesh. The repository is a modular monolith with four boundaries:

- **`apps/api`** — Node 22 HTTP API (PostgreSQL source of truth, server-authoritative business rules).
- **`apps/web`** — Next.js 16 customer storefront.
- **`apps/admin`** — Next.js 16 operations/admin UI.
- **`apps/worker`** — background worker (courier webhook outbox, jobs).

Shared code lives in `packages/*`; infrastructure and deployment files live in `infra/`; agent workflow and specs live in `docs/`.

---

## Prerequisites

- Node.js **22** (`>=22 <23`)
- Docker Engine + Docker Compose **v2**
- (optional, production only) a VPS/host and domain names

---

## Quick start (development)

One command starts everything: infrastructure containers, runs database migrations, and launches api + web + admin + worker with prefixed logs. Press **Ctrl+C** to stop all of them.

> `npm run dev` now auto-loads the repository-root `.env` before starting any
> service (Node does not read `.env` on its own). Copy `.env.example` to `.env`
> first; `DATABASE_URL` must be set or the runner exits with a helpful error.

```bash
npm install
cp .env.example .env   # first time only
npm run dev
```

What it does automatically:

1. `docker compose -f infra/docker-compose.yml up -d postgres redis minio`
2. `npm run db:migrate`
3. Starts `api` (port 4000), `web` (port 3000), `admin` (port 3001), `worker`

Open:

- Storefront: http://localhost:3000
- Admin:     http://localhost:3001
- API:       http://localhost:4000/health/ready

To skip infrastructure bring-up (when everything is already running):

```bash
npm run dev -- --no-infra
```

---

## Production (containers)

The same Dockerfiles used in development are reused for production. The production stack runs from the standalone `infra/docker-compose.prod.yml` project (`pcx-prod`), fully isolated from the dev stack.

```bash
# 1. Prepare production environment (do this once)
cp infra/.env.example infra/.env   # then edit real values

# 2. Build images
npm run prod:build

# 3. Start the full stack (runs migrations first, then api/web/admin/worker + proxy)
npm run prod:up

# 4. Stop the full stack
npm run prod:down
```

On a production host, after `git pull` use the single deploy command:

```bash
npm run deploy        # git pull --ff-only + build + up
```

Published entries (local/prod default):

| Entry | URL | Backing service |
|---|---|---|
| Storefront | http://localhost:8080 | `web:3000` |
| Admin | http://localhost:8081 | `admin:3001` |
| API | http://localhost:4000 | `api:4000` |

The reverse proxy (Caddy) is the only public entrypoint; PostgreSQL, Redis, and MinIO stay internal to the compose network and are not published to the host.

---

## Command reference

| Command | Purpose |
|---|---|
| `npm run dev` | Start full local dev stack (infra + migrate + api/web/admin/worker) |
| `npm run dev -- --no-infra` | Same, but skip infra bring-up |
| `npm run dev:api` | API only (dev) |
| `npm run dev:web` | Customer web only (dev) |
| `npm run dev:admin` | Admin web only (dev) |
| `npm run dev:worker` | Worker only (dev) |
| `npm run prod:build` | Build production images |
| `npm run prod:up` | Start the production stack |
| `npm run prod:down` | Stop the production stack |
| `npm run deploy` | Production host: `git pull` + build + up |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run verify:e0` | E0 artifact verification |
| `npm test` | Run the full test suite |
| `npm run verify` | E0 + lint + typecheck + tests + build + security |
| `npm run verify:ci` | `verify` + PostgreSQL integration + E2E smoke |
| `npm run release:preflight` | Staging/backup/restore readiness check |
| `npm run db:backup` / `npm run db:restore-drill` | Backup / restore drill |

---

## Environment variables

Development reads the repository-root `.env` (git-ignored). Production reads `infra/.env` (git-ignored; copy from `infra/.env.example`).

| Variable | App | Purpose |
|---|---|---|
| `DATABASE_URL` | api, worker, migrate | PostgreSQL connection string |
| `API_PORT` | api | API listen port (default 4000) |
| `PCX_API_ORIGIN` | api | Comma-separated allowed browser origins |
| `PCX_API_ORIGIN` | web, admin | Server-side API destination baked into rewrites at build |
| `API_ALLOWED_ORIGINS` | compose | Allowed origins injected into the API container |
| `WEB_API_ORIGIN` | web (compose) | API destination for the storefront |
| `ADMIN_API_ORIGIN` | admin (compose) | API destination for the admin UI |
| `POSTGRES_PASSWORD` | postgres (prod compose) | Local prod Postgres password (placeholder only) |
| `MINIO_ROOT_PASSWORD` | minio (prod compose) | Local prod MinIO password (placeholder only) |
| `COURIER_WEBHOOK_SECRET` | api, worker | Shared secret to validate courier webhooks |
| `PAYMENT_CREDENTIALS_KEY` | api | Key used to encrypt stored payment credentials (AES-256-GCM) |
| `TEST_DATABASE_URL` | api integration tests | Override DB for integration tests (tests auto-skip when unset) |
| `SMOKE_DATABASE_URL` | smoke | Override DB for the E2E smoke path |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | agent loop (opt-in) | DeepSeek executor (`--deepseek-executor`) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | agent loop (opt-in) | OpenAI reviewer (`--openai-review`) |
| `PCX_AGENT_ENVIRONMENT` | control plane | `local` (default) or `production` policy gate |

---

## Secrets & hard stops

- `.env` (root) and `infra/.env` are git-ignored. Only `*.env.example` placeholders are committed.
- **Never commit or store in the repo**: real database credentials, JWT/session secrets, payment/webhook secrets, `PAYMENT_CREDENTIALS_KEY`, or any production secret. Inject them from a secret manager/environment on a real host.
- **Production deployment is a hard stop.** The `npm run deploy` / `npm run prod:up` commands are provided as runbooks, but actually running them against a real production host, configuring real domains/TLS, or creating real credentials requires explicit human approval.
- Also hard stops: destructive/irreversible migrations, production/customer-data deletion, payment destination or provider credential changes, production secret rotation, disabling tests/security controls, large framework replacement, and core invariant/source-of-truth changes.

---

## Repository layout

```
apps/
  api/       Node 22 HTTP API + migrations + tests
  web/       Next.js storefront
  admin/     Next.js operations UI
  worker/    background worker
packages/
  config/    shared configuration
  domain/    source-of-truth domain rules
  testing/   shared test helpers
  ui/        shared UI primitives
infra/
  docker-compose.yml           development infrastructure (postgres/redis/minio/worker)
  docker-compose.prod.yml      production full stack (app tier + proxy)
  docker-compose.staging.yml   staging overlay
  Caddyfile                    local reverse proxy
docs/
  brain/        concise retrieval aids
  specifications/  approved source of truth
  adr/          architecture decision records
  tasks/        bounded task evidence
  handoffs/     completion records
  agentic/      portable agent workflow
scripts/
  dev.mjs       one-command development runner
  prod.mjs      production build/up/down/deploy runner
```

---

## Testing & quality gates

The repository requires these checks before committing:

```bash
npm run verify:e0      # required artifacts
npm run lint
npm run typecheck
npm test               # unit + application tests
npm run build
npm run security       # secrets + dependency scan
```

Combined:

```bash
npm run verify         # all of the above
npm run verify:ci      # + PostgreSQL integration + E2E smoke
npm run release:preflight
```

---

## Working with coding agents

This repository is agent-ready. To start a new agent session, point it at `AGENTS.md` or use `docs/agentic/START_PROMPT.md`. The approved specifications in `docs/specifications/` and accepted ADRs in `docs/adr/` are the source of truth; the concise brain documents in `docs/brain/` are retrieval aids, not replacements. See `docs/agentic/PORTABLE_AGENT_WORKFLOW.md` for the complete workflow.
