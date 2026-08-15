# ADR 0003: Server-side authentication and authorization boundary

- Status: Proposed
- Date: 2026-08-16

## Context

E1 requires sessions, refresh, role/permission policy, object ownership, privileged MFA integration, and auditability.

## Proposed decision

Keep identity and policy enforcement inside the API modular monolith. Use short-lived opaque access sessions plus rotating refresh credentials stored only as hashes. Role checks and object ownership policies compose under default deny. Final persistence and crypto library choices require E1 review before acceptance.

## Hard-stop note

This ADR is proposed, not accepted. E1 may build framework-neutral domain contracts and tests, but must not lock production authentication policy or credentials without review.
