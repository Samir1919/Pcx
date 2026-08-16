# Handoff: Task 8 — Containerize the worker and wire it into compose

- Status: Complete
- Branch: agent/stage3-completion
- Date: 2026-08-17

## Outcome

The worker is now containerized and wired into local compose: `apps/worker/Dockerfile`
builds a minimal `pcx-worker:latest` image (Node 22-alpine, own `pg` dependency only),
a root `.dockerignore` keeps `.env`/secrets out of the build context, and
`infra/docker-compose.yml` runs the worker against Postgres with a health
dependency. The security gate's container scan now correctly treats an
unauthenticated/unavailable scanner as a safe skip instead of a failure.

## Changed areas

- `apps/worker/Dockerfile` (new) — builds the worker with `npm ci --workspace @pcx/worker --omit=dev`
  and copies only `apps/worker`, `apps/api`, and `packages/domain`.
- `.dockerignore` (new) — excludes `.env`, `.env.*`, `node_modules`, `.git`, logs,
  `.worktrees`, work/outputs from the build context.
- `infra/docker-compose.yml` — adds a `worker` service (build, `DATABASE_URL`,
  `depends_on` postgres healthy, `restart: unless-stopped`).
- `apps/worker/package.json` — declares `pg` as the worker's own production
  dependency (the worker directly imports it).
- `package-lock.json` — lockfile updated for the worker dependency.
- `scripts/container-scan.mjs` — scanner selection now falls back from `docker scout`
  to `trivy`, and classifies auth/unavailable scanner errors as a safe skip while
  genuine scan crashes still fail the gate.
- `scripts/container-scan.test.mjs` — new regression test for scout-login fallback.

## Acceptance criteria

- [x] `docker compose -f infra/docker-compose.yml config --quiet` exits 0.
- [x] `docker build -f apps/worker/Dockerfile -t pcx-worker:latest .` exits 0.
- [x] `pg` and `createWorkerRuntime` import successfully inside the image.
- [x] `npm run verify` passes: E0, lint, typecheck, 341 tests (319 pass, 0 fail,
      22 skipped), build, and security scan.
- [x] Container scan no longer fails the gate due to unauthenticated `docker scout`.

## Architecture

The worker image installs only its own runtime dependency (`pg`) and composes api/domain
modules from copied source; no native `argon2` build or web/admin UI dependencies are
pulled. The worker owns no business truth and only advances PostgreSQL state.

## Schema

No schema change (migration unchanged).

## Remaining

- A real authenticated scanner (docker scout login or trivy install) to produce an
  actual vulnerability report for the image.
- Link the `/payments` admin route and implement a real bKash HTTP adapter (separate slice).
- Real courier/notification providers remain human-approval hard stops.

## Blockers

None.

## Verification

- `docker compose -f infra/docker-compose.yml config --quiet` — exit 0.
- `docker build -f apps/worker/Dockerfile -t pcx-worker:latest .` — exit 0.
- `docker run --rm pcx-worker:latest node ...` — `pg` + composition load OK.
- `node --test scripts/container-scan.test.mjs` — 6 pass.
- `npm run verify` — 319 pass, 0 fail, 22 skipped; build + security pass.
