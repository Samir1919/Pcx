# Task: CLINE_AUDIT_FIX_07 — PostgreSQL pool timeouts

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (operational hardening)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Bound PostgreSQL connection and query latencies so an unreachable or hung
database cannot hold a request handler or the `/health/ready` probe open
indefinitely.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #7

## Scope

- `apps/api/src/index.mjs`: add `connectionTimeoutMillis`, `query_timeout`,
  `statement_timeout`; bound the readiness probe with a race timeout.
- `apps/api/src/infrastructure/database/migrate.mjs`: add connection/statement
  timeouts to the migration pool.
- `apps/worker/src/main.mjs`: add the same pool bounds to the worker runtime pool.

## Non-scope

- Test-only pools (integration tests) are unchanged.

## Domain invariants affected

None (operational).

## Acceptance criteria

- [x] Runtime and migration pools carry timeouts.
- [x] Readiness probe is explicitly bounded.

## State/API/schema/UI impact

None.

## Security and privacy review

No new trust-boundary exposure.

## Test plan

- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
