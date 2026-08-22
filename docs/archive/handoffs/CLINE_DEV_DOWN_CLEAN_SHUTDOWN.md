# Agent Handoff: `dev:down` clean shutdown for local dev stack

- Status: Complete
- Branch: main
- Latest commit: e355bee
- Date: 2026-08-18

## Outcome

Added a one-command "off switch" for the local development stack. `npm run dev:down` now stops the API/web/admin/worker host processes (freeing ports 4000/3000/3001) and stops/removes the local infra containers via `docker compose down`. This closes the loop that previously caused `EADDRINUSE` because `scripts/dev.mjs` never stops infra containers, and a backgrounded/abandoned dev stack could leave orphan processes holding port 4000.

## Changed areas

- `scripts/dev-down.mjs` (new)
  - Pure helpers are dependency-injected so they are unit-testable: `findPidsOnPort` (lsof), `findPidsByPattern` (pgrep), `gracefulKill` (SIGINT then SIGKILL fallback), `stopHostProcesses`, `stopInfraContainers`, `resolveHostGroups`, plus `uniqueIds`/`parsePidLines`.
  - CLI modes: default `down`, `--stop` (stop containers without removing), `--no-infra` (host processes only).
  - Development only; never touches production/staging, never deletes volumes/data, never reads real credentials.
- `scripts/dev-down.test.mjs` (new) — 11 unit tests covering the helpers above.
- `package.json` — added `"dev:down": "node scripts/dev-down.mjs"`.

## Acceptance criteria

- [x] `npm run dev:down` stops all host dev processes and reports their PIDs.
- [x] Infra containers (postgres/redis/minio) are stopped and removed by default.
- [x] Ports 4000, 3000, 3001 verified free afterward.
- [x] Unit tests added and passing.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/dev-down.test.mjs` | Pass (11/11) |
| `npm run verify` | Pass (394 pass, 22 skipped, 0 fail; lint/typecheck/build/security pass) |
| `npm run dev:down` | Pass (5 host processes stopped, 3 containers removed) |
| `lsof` on 4000/3000/3001 | All free |

## Architecture/security review

No domain invariants, authz, or business-truth changes. Script signals processes by pid using `lsof`/`pgrep`; it never parses unrelated processes beyond the known ports/patterns and always excludes its own pid. No new ADR required — this is a dev-tooling convenience consistent with `scripts/dev.mjs` and `scripts/prod.mjs`.

## Schema/configuration/deployment

None. No migrations, no env changes, no production impact.

## Remaining work and next safe action

1. (Optional) Document `npm run dev:down` in the developer README alongside `npm run dev`.
2. (Optional) Wire the same cleanup into a dev container pre-stop hook if containerized dev becomes the default.

## Blockers requiring human decision

None.
