# Agent Handoff: Staging Compose Smoke

- Status: Complete
- Branch: `agent/staging-compose-smoke`
- Latest commit: `b0af85f`
- Date: 2026-08-23

## Outcome

Task J of `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`. The staging compose
overlay is now a full production-like stack (not just infra), and a one-command
`npm run staging:smoke` builds, starts, verifies, and tears it down in an
isolated `pcx-staging` project with synthetic credentials.

## Changed areas

- `infra/docker-compose.staging.yml`: added `migrate`, `api`, `worker`, `web`,
  `admin`, and a Caddy `proxy` (isolated host ports 8082/8083) on top of the
  existing infra services; all credentials are synthetic.
- `scripts/staging-smoke.mjs` (new): `up -d --build` → wait for API
  `/health/ready` → probe web/admin proxies → `down`.
- `package.json`: added `staging:smoke` script.

## Acceptance criteria

- [x] Full dockerized stack healthy (api ready; web/admin proxy respond).
- [x] Isolated project/ports/volumes (does not touch dev or prod stacks).
- [x] No deploy; synthetic credentials only.

## Verification

| Command/test | Result |
|---|---|
| `docker compose -f infra/docker-compose.staging.yml config --quiet` | Pass |
| `npm run staging:smoke` | PASS (api ready; web/admin proxy responding) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run verify:e0` | Pass (33 required artifacts) |
| `npm test` | 560 / 0 fail |

## Architecture/security review

- No application invariant changed.
- Real domains, TLS, and secrets remain human-approval hard stops; the smoke
  runs entirely on synthetic, non-production credentials and local ports.
- The staging project name/ports/volumes are isolated from `pcx-prod` and the
  default dev stack.

## Remaining work / next safe action

1. Real production deployment and real provider credentials remain hard stops.
2. Optional: bulk CSV import, real container scanner, real bKash HTTP adapter.

## Blockers requiring human decision

None.
