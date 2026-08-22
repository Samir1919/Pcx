# Task: Autonomous Safe Slices (executor contract, courier outbox, container scan, branch cleanup)

- Status: In progress
- Owner/agent: autonomous
- Branch: `agent/autonomous-safe-slices`
- Risk: Low
- Related epic: Stage 3 control plane / Stage 2 release discipline
- Related ADRs: 0005 (control plane), 0007 (executor contract, new)

## Objective

Complete the four remaining safe (non-hard-stop) dependency-ready slices autonomously:
1. Vendor-neutral external-agent executor contract (approve + implement validation).
2. Courier webhook retry/outbox delivery guarantees.
3. Container image scan (when an image exists).
4. Stale `agent/*` branch review and cleanup.

## Source-of-truth references

- `AGENTS.md`
- `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md`
- `docs/adr/0005-stage3-control-plane.md`
- `docs/status/PROJECT_STATUS.md`

## Scope

- Each slice is a bounded, verified, committed, and handed-off unit.
- All changes are additive and repository-local; no production, credential, destructive-migration, or invariant change.

## Non-scope

- Production deployment, real provider credentials, destructive migrations, customer-data deletion, test/security weakening, core invariant changes (all hard stops).
- Wiring a specific vendor (Cline/DeepSeek) CLI/API — only the vendor-neutral contract is defined here.

## Domain invariants affected

- None. Server-authoritative shipment state and idempotency are preserved (courier outbox).
- Executor contract preserves default-deny policy and hard-stop enforcement.

## Acceptance criteria

- [ ] ADR 0007 documents the vendor-neutral executor contract.
- [ ] Executor output validation helper exists and is tested.
- [ ] Courier webhook events are durably queued and retried; idempotency preserved.
- [ ] Container image scan runs when an image exists and skips safely otherwise.
- [ ] Stale `agent/*` branches are reviewed and deleted; no valuable unmerged work lost.
- [ ] `npm run verify` passes after each slice.

## State/API/schema/UI impact

- Courier outbox adds an additive migration (`0020_*`).
- No public API or UI change.

## Security and privacy review

- Executor contract rejects secret-bearing artifacts and enforces default-deny.
- Courier outbox preserves server-authoritative state transitions and timing-safe webhook secret validation.
- Container scan uses no credentials and skips when no image exists.
- Branch cleanup deletes only merged/superseded branches.

## Test plan

- Unit: executor contract validation, courier outbox enqueue/retry/idempotency, container scan skip/run.
- Integration: courier outbox migration.
- Full gate: `npm run verify` after each slice.

## Migration and rollback

- Courier outbox migration is additive and reversible (drop table). No destructive migration.

## Prohibited changes / hard stops

- No production deployment, real credentials, destructive migration, customer-data deletion, test/security weakening, or core invariant change.
