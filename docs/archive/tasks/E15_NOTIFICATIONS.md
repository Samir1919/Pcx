# Task: E15 Notifications

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/stage2-release-discipline`
- Risk: Medium
- Related epic: E15 — Notifications
- Related ADRs: ADR 0001, ADR 0002

## Objective

Provide provider-neutral notification delivery with an outbox (never rolls back primary business transaction on delivery failure), typed channels/status, and admin-gated creation + dispatch.

## Source-of-truth references

- `AGENTS.md`
- `docs/specifications/DATABASE_ERD.md` (Section 16)
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`

## Scope

- Domain: `Notification` PENDING→SENT/FAILED, channels EMAIL/SMS/PUSH.
- Migration `0017_notifications.sql`: outbox table + pending index.
- Repository/service/HTTP: admin-gated create, provider-neutral dispatcher dispatch.

## Non-scope

- Actual concrete email/SMS/push providers (deferred; provider credentials are a production hard stop).
- Support tickets/CRM.

## Domain invariants affected

- Notification delivery failure does not roll back primary business transaction (outbox pattern).
- Notification status is server-owned.

## Acceptance criteria

- [x] Notification create requires `SYSTEM_CONFIGURE`.
- [x] Outbox stores PENDING with payload snapshot.
- [x] `dispatchDue` marks SENT on success and FAILED on provider error, never rolls back.
- [x] Channels/types validated.
- [x] `npm run verify:ci` passes.

## State/API/schema/UI impact

Adds `POST /api/v1/admin/notifications`. Adds migration `0017`.

## Security and privacy review

`hasPermission(identity, SYSTEM_CONFIGURE)` default deny; payload snapshot only; no provider credentials in repo.

## Test plan

- Domain: channel validation, lifecycle transitions.
- Service: permission gate, dispatch sent/failed paths.
- HTTP: create/forbidden/missing-service.
- Integration: outbox persistence + mark sent/failed.

## Migration and rollback

Additive migration `0017_notifications.sql`.

## Prohibited changes / hard stops

No concrete provider credentials, no production deployment.
