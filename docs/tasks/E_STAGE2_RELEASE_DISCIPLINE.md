# Task: Stage 2 Release Discipline Gates

- Status: In progress
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security-sensitive
- Related epic: E2 (integration/release discipline)
- Related ADRs: ADR 0001, ADR 0002, ADR 0003, ADR 0004

## Objective

Close the remaining Stage 2 gates recorded in `docs/status/PROJECT_STATUS.md`: secret/dependency scanning, production-like staging configuration, a running E2E smoke path, and restoreable database backup/restore tooling with a drill.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/INFRASTRUCTURE_DEVOPS.md` (sections 4, 10, 15, 21, 23, 25)
- `docs/specifications/SECURITY_ARCHITECTURE.md` (sections 18, 19, 22, 24)
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md` (Stage 2 required capabilities)

## Scope (four bounded slices)

1. Security scanning gate: deterministic secret scan + `npm audit --omit=dev`, wired into `npm run verify`.
2. Staging configuration: production-like compose overlay and explicit env template without secrets.
3. E2E smoke path: boot server + migration, exercise a real HTTP read round-trip.
4. Backup/restore gate: `pg_dump`/restore scripts and a restore drill test.

## Non-scope

- Production deployment, real production secrets/credentials.
- Distributed limiter/MFA provider, container image scanning (no image build yet).
- Kubernetes/cloud orchestration.

## Acceptance criteria

- [x] Secret scan is deterministic, fails on committed high-signal secrets, and ignores documented local/test fixtures.
- [x] Dependency audit blocks high vulnerabilities and reports zero for current deps.
- [x] `npm run verify` includes the security gate and the full `verify:ci` passes.
- [ ] Staging overlay boots PostgreSQL/Redis/MinIO with isolated synthetic credentials and an explicit env template.
- [ ] Smoke path boots the API, runs migrations, and returns the fittest health/catalog read.
- [ ] Backup script produces a restorable dump and the restore drill recovers a row.

## Security and privacy review

No production secret is introduced. Staging credentials are synthetic and marked non-production. Backup/restore operates on local synthetic data only. Secret scan skips only test/example/.env.example files and the documented synthetic allow-list.

## Test plan

- `node scripts/secret-scan.mjs` must pass on a clean checkout.
- `npm audit --omit=dev --audit-level=high` must return zero.
- `npm run verify:ci` must pass.
- `node scripts/smoke-test.mjs` must return a real HTTP 200/relevant read.
- Restore drill test must recover a seeded row to an empty database.

## Migration and rollback

None (additive tooling only). All new files are scripts/docs/CI; no schema change.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops; no production deployment, no real credentials, no destructive migration.
