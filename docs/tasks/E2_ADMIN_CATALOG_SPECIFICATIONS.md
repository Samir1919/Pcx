# Task: E2 Admin Catalog Specifications

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e2-admin-specifications`
- Risk: Security-sensitive
- Related epic: E2
- Related ADRs: ADR 0001, ADR 0002, ADR 0003

## Objective

Provide authorized, audited administration of specification definitions and typed ProductModel values.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`
- Approved E2 catalog/API/security specifications

## Scope

- Create, update, and archive specification definitions.
- Upsert category-aligned typed model values.
- Protected admin HTTP routes and atomic PostgreSQL audit writes.

## Non-scope

- Admin UI, physical inventory facts, pricing, and production deployment.

## Domain invariants affected

- ProductModel remains separate from InventoryItem; commands accept only catalog metadata.
- Client input cannot own lifecycle, identifiers, authorization, or audit actor.
- State and authorization remain server-enforced.

## Acceptance criteria

- [x] Only catalog-managing roles can execute commands.
- [x] Definition identity/category/key/type are server-owned or immutable after creation.
- [x] Values enforce definition type and ProductModel category.
- [x] Mutation and audit commit in one transaction.
- [x] Origin, CSRF, body bounds, and stable errors protect HTTP commands.

## State/API/schema/UI impact

Adds admin definition POST/PATCH/DELETE and model specification PUT endpoints over the existing schema. No UI or migration.

## Security and privacy review

Access authentication plus `catalog:manage`, exact-origin and double-submit CSRF checks, field allow-lists, bounded JSON, server audit actor, and non-leaking errors.

## Test plan

- Unit: service authorization, ownership, immutability, type validation.
- Integration: typed upsert and audit persistence.
- Security: protected HTTP route tests.
- Full gate: `npm run verify:ci`.

## Migration and rollback

None. Roll back application files; existing data/schema remain compatible.

## Prohibited changes / hard stops

All `AGENTS.md` hard stops; especially no core invariant, production, or destructive schema changes.
