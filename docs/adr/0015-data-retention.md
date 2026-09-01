# ADR 0015: Bounded data retention for safe-to-purge rows

- Status: Accepted
- Date: 2026-09-01

## Context

The system is append-only by design for auditability: audit events, financial
records, inspections, and catalog/listings soft-deletes are never hard-deleted
(the archive pattern preserves history). Several tables, however, accumulate
obsolete rows that can never be referenced by an active business flow again
(closed reservations, delivered notifications, expired/revoked sessions, closed
offers). Without a retention pass these grow without bound.

## Decision

Add a daily worker retention job that hard-deletes **only safe-to-purge rows**:

- `reservations` with status `EXPIRED`/`CANCELLED` past `reserved_until` (30 days).
- `notifications` with status `SENT`/`FAILED` past `created_at` (7 days).
- `access_sessions` revoked or expired (30 days).
- `offers` with status `EXPIRED`/`REJECTED`/`WITHDRAWN` past `expires_at` (30 days).

Each category is independent and best-effort: a failure in one is collected, not
thrown, so a single blocked table never halts the pass. The windows are defaults
in `retention-service.mjs` and can be tuned later.

**Never purged here (out of scope by policy):**

- **Financial/legal records** — `orders`, `payments`, `acquisitions`, refunds.
- **Inventory** and **inspections** — physical lifecycle + submitted history.
- **Audit events** (`auth_audit_events`, `audit_logs`) — append-only compliance
  trail. Future work may cold-archive these to object storage before purging,
  but they are not hard-deleted by the retention job.

## Consequences

- `postgres-retention-repository.mjs` + `retention-service.mjs` (no HTTP surface;
  worker-only). The worker runs it on a 24h throttle.
- No invariant changes: sold facts, idempotent financial records, submitted
  inspection history, and unique lifecycle identity are preserved.
- Storage growth from the four safe categories is bounded; audit/legal/financial
  growth remains intentional and is addressed separately (cold archive, future).
