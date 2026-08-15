# ADR 0002: PostgreSQL as source of truth

- Status: Accepted
- Date: 2026-08-16

## Decision

PostgreSQL owns durable identity, lifecycle, inventory, order, payment, and audit facts. Redis, queues, and search are derived or ephemeral systems.

## Consequences

Critical uniqueness and integrity use database constraints and transactions. Derived systems must be replayable and cannot authorize commerce state.
