# Handoff: Task 2 — Courier webhook retry/outbox delivery guarantees

- Status: Complete
- Branch: `agent/autonomous-safe-slices`
- Date: 2026-08-17

## Outcome

Added a durable outbox for inbound courier webhook events so a delivery/return event is never lost between receipt and state transition, plus a worker job that retries PENDING events until they are APPLIED or permanently FAILED.

## Changed areas

- `apps/api/migrations/0020_shipment_webhook_outbox.sql` — new `shipment_webhook_events` table (PENDING/APPLIED/FAILED, retry_count, next_attempt_at).
- `apps/api/src/modules/logistics/postgres-shipment-repository.mjs` — added `enqueueWebhookEvent`, `listPendingWebhookEvents`, `markWebhookApplied`, `markWebhookFailed`.
- `apps/api/src/modules/logistics/shipment-service.mjs` — `handleWebhook` now durably enqueues every event before application; added `dispatchDueWebhookEvents` worker job with retry budget (`maxWebhookRetries`).
- `apps/worker/src/worker.mjs` — replaced stub with a real worker that dispatches due webhook events and notifications.
- `apps/worker/test/worker.test.mjs` — new worker tests.
- `apps/api/test/shipment-service.test.mjs` — added 7 outbox tests.

## Acceptance criteria

- [x] Every webhook is durably enqueued before application.
- [x] A worker job retries PENDING events and marks them APPLIED or FAILED.
- [x] Retry budget is bounded (`maxWebhookRetries`).
- [x] `npm run verify:e0` passes.
- [x] `npm test` passes (275 pass, 0 fail).

## Architecture

`handleWebhook` validates the signature, then calls `repository.enqueueWebhookEvent` (durable INSERT) before applying the transition. On success the event is marked APPLIED; on a crash between enqueue and apply, the event stays PENDING. `dispatchDueWebhookEvents` (wired into the worker) lists PENDING events whose `next_attempt_at` is due, applies the transition idempotently (already-final shipments are no-ops), and marks APPLIED; on failure it increments `retry_count` and schedules a backoff, or marks FAILED once the budget is exhausted.

## Schema

New table `shipment_webhook_events` (migration 0020).

## Remaining

- Wiring the worker into the deployment runtime (docker-compose) is a deployment concern, not a code change.

## Blockers

None.

## Verification

- `node --test apps/api/test/shipment-service.test.mjs` — 18 pass.
- `node --test apps/worker/test/worker.test.mjs` — 5 pass.
- `npm run verify:e0` — E0 verified: 36 required artifacts.
- `npm test` — 275 pass, 0 fail, 22 skipped (DB integration).
