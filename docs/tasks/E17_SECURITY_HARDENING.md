# Task: E17 Security Hardening

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Security
- Related epic: E17 — Security hardening
- Related ADRs: ADR 0003

## Objective

Add baseline response security headers and regression coverage.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/SECURITY_ARCHITECTURE.md`

## Scope

- Shared response layer sets `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, and a restrictive `content-security-policy`.
- Regression test asserting all four headers.

## Non-scope

- Upload scanning, HSTS (TLS-termination), CSP allowlisting for admin UI.

## Domain invariants affected

- Defense-in-depth on every API response.

## Acceptance criteria

- [x] All responses include baseline security headers.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

No route/schema change.

## Security and privacy review

Adds only security headers; reduces sniffing/clickjacking/referrer exposure.

## Test plan

- `security-headers.test.mjs` asserts headers on `/health/live`.
- `health.test.mjs` updated baseline.

## Migration and rollback

None.

## Prohibited changes / hard stops

No security control weakening, no production deployment.
