# ADR 0001: Modular monolith

- Status: Accepted
- Date: 2026-08-16

## Context

PCX needs strong transactional commerce rules and a small-team operating model without premature distributed-system complexity.

## Decision

Use a modular monolith with separate deployable web/admin/API/worker boundaries and PostgreSQL as transactional truth. Domain modules communicate through explicit application contracts.

## Consequences

Transactions, testing, and deployment stay simple. Module boundaries must be enforced in code review. Extraction to services is allowed only after measured pressure and a new ADR.
