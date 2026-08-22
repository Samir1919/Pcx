# Agent Handoff: E15 Notifications

- Status: Complete
- Branch: `agent/stage2-release-discipline`
- Latest commit: pending (committed with this slice)
- Date: 2026-08-16

## Outcome

Provider-neutral notification delivery with an outbox (PENDING→SENT/FAILED), admin-gated creation and dispatch; a provider failure marks the notification FAILED without ever rolling back the primary business transaction.

## Changed areas

- `packages/domain/src/notification/notification.mjs`: notification lifecycle/channel contracts.
- `packages/domain/src/index.mjs`: exports.
- `apps/api/migrations/0017_notifications.sql`: notifications outbox + pending index.
- `apps/api/src/modules/notification/*`: repository/service/HTTP boundary.
- `apps/api/src/modules/identity/auth-runtime.mjs` + `server.mjs`: wiring/routing.
- Tests: domain `notification`, service `notification-service`, HTTP `notification-http`, integration `notification-repository`; migrations/runtime updated.

## Acceptance criteria

- [x] Create requires `SYSTEM_CONFIGURE`.
- [x] Outbox stores PENDING with payload snapshot.
- [x] `dispatchDue` marks SENT/FAILED, never rolls back.
- [x] Channels/types validated.
- [x] `npm run verify:ci` passes.

## Verification

| Command/test | Result |
|---|---|
| `npm test` | Pass: 203 application/unit, 0 failures |
| `npm run test:integration` | Pass: 21/21 (incl. notifications) |
| `npm run smoke` | Pass: 14 categories returned |
| `npm run verify:ci` | Pass: security + build + 203 unit + 21 integration + 1 smoke |

## Architecture/security review

`hasPermission(default deny)`; outbox decouples delivery from business transactions; payload snapshot only; no provider credentials. No hard stop bypassed.

## Schema/configuration/deployment

Additive migration `0017_notifications.sql`.

## Remaining work and next safe action

1. E16 audit/observability/jobs.
2. E17 security hardening.
3. E18 backup/staging/release readiness.

## Blockers requiring human decision

Concrete email/SMS/push provider credentials remain a production hard stop.
