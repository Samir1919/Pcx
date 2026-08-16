# Handoff: Task 7 — Wire worker into the local runtime

- Status: Complete
- Branch: agent/stage3-completion
- Date: 2026-08-17

## Outcome

The worker daemon entrypoint (`apps/worker/src/main.mjs`) now composes the real
shipment and notification services over a PostgreSQL pool and starts the background
job loop, so `npm run dev:worker` dispatches due courier webhook outbox events and
due notifications instead of printing a stub. This closes the "remaining" item from
`AUTONOMOUS_TASK2_COURIER_WEBHOOK_OUTBOX.md`.

## Changed areas

- `apps/worker/src/composition.mjs` (new) — `createWorkerRuntime` composes the real
  shipment and notification services from `createShipmentService` /
  `createPostgresShipmentRepository` / `createNotificationService` /
  `createPostgresNotificationRepository` and a `startWorker`. The worker never
  authenticates; a fail-closed `workerAuthService` stub rejects any accidental
  authenticated call.
- `apps/worker/src/main.mjs` (new) — the daemon entrypoint builds a `pg.Pool`
  from `DATABASE_URL` (default `postgresql://pcx:pcx_local_only@localhost:5432/pcx`),
  calls `createWorkerRuntime({ unref: false })`, and starts the worker so the
  foreground process stays alive between ticks.
- `apps/worker/src/worker.mjs` — `startWorker` now accepts an `unref` flag (default
  `true` to keep tests/short-lived callers non-blocking; the daemon passes `false`).
- `package.json` — `dev:worker` now runs `apps/worker/src/main.mjs`.
- `apps/worker/test/composition.test.mjs` (new) — composition and dispatch wiring
  tests using a fake pool.

## Acceptance criteria

- [x] Worker composes the real shipment and notification services (not a stub).
- [x] `npm run dev:worker` starts a real foreground loop that polls both the
      courier webhook outbox and the notification outbox.
- [x] No database query is issued until the worker ticks (construction-time only).
- [x] Worker never authenticates; a fail-closed stub rejects accidental auth.
- [x] `npm run typecheck`, `npm run lint`, `npm run verify:e0`, `npm run build`,
      `npm run security` all pass.
- [x] `npm test` passes: 318 pass, 0 fail, 22 skipped (DB integration).

## Architecture

`createWorkerRuntime` is the worker-side mirror of `createAuthRuntime`: both consume
the same modular-monolith domain services (`shipmentService`, `notificationService`).
The worker only advances durable state the services own (idempotent dispatch of the
courier webhook outbox and the notification outbox); it does not manipulate another
module's tables and does not own business truth.

## Schema

No schema change.

## Remaining

- A container image (Dockerfile) for the worker and its `docker-compose.yml` service
  entry is a deployment concern; the repo still has no application Dockerfiles.
- Real courier/notification providers remain human-approval hard stops.

## Blockers

None.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `node --test apps/worker/test/*.test.mjs` — 8 pass.
- `npm test` — 318 pass, 0 fail, 22 skipped (DB integration).
- `npm run verify:e0` — 36 required artifacts.
- `npm run build` — application boundaries load successfully.
- `npm run security` — secrets + dependencies + container pass.
