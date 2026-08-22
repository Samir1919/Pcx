# Task: E18 Backup, Staging & Release Readiness

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E18 — Backup, staging & release readiness
- Related ADRs: ADR 0002

## Objective

Provide a release preflight that verifies staging/backup/restore artifacts exist and contain no placeholder secrets, plus a release runbook.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/INFRASTRUCTURE_DEVOPS.md`

## Scope

- `scripts/release-preflight.mjs`: verifies staging compose, staging env example, backup/restore scripts exist and no placeholder secret literals.
- `package.json` script `release:preflight`.
- `docs/handoffs/E18_BACKUP_STAGING_RELEASE_READINESS.md` runbook notes.

## Non-scope

- Real production deployment and real secrets (production hard stop).

## Domain invariants affected

- No customer data mutation.

## Acceptance criteria

- [x] `npm run release:preflight` exits 0 with all artifacts present.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

None.

## Security and privacy review

Preflight fails on placeholder literal secrets; no real secrets stored.

## Test plan

- Manual run of `release-preflight.mjs` (exit 0).
- Full `verify:ci`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No production deployment.
