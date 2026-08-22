# Task: E1 Self-Owned Address Application Service

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-address-service`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Apply authenticated ownership and domain validation to self-address list/create/update/delete operations.

## Scope

- Authenticate opaque access credentials for every operation.
- Validate create and merged PATCH data through the domain address contract.
- Generate server IDs/timestamps and hide inaccessible records as not found.

## Non-scope

- HTTP/CSRF, admin access, geocoding, automatic default promotion.

## Acceptance criteria

- [x] Caller cannot supply authoritative owner ID.
- [x] Create/update use domain validation and server IDs/timestamps.
- [x] PATCH merges only allow-listed address fields.
- [x] Cross-owner/missing update/delete is one not-found result.

## Security and test plan

Unit ownership/validation/mass-assignment tests plus full verify.

## Migration and rollback

None.

## Prohibited changes / hard stops

No cross-owner access, client-owned identity, or public PII exposure.
