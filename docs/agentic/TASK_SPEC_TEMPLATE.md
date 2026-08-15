# Task: <Epic / Slice Name>

- Status: Proposed | Approved | In progress | Complete | Blocked
- Owner/agent:
- Branch: `agent/<description>`
- Risk: Low | Medium | High | Security-sensitive
- Related epic:
- Related ADRs:

## Objective

State one concrete outcome.

## Source-of-truth references

- `AGENTS.md`
- Relevant brain/spec sections
- Relevant accepted ADRs

## Scope

- Included behavior

## Non-scope

- Explicitly deferred behavior

## Domain invariants affected

- List each relevant invariant and how it remains protected

## Acceptance criteria

- [ ] Observable criterion

## State/API/schema/UI impact

Describe only affected surfaces.

## Security and privacy review

Authentication, authorization, ownership, sensitive data, audit, rate limit, replay/idempotency, and abuse considerations.

## Test plan

- Unit:
- Integration:
- E2E/concurrency/security where relevant:
- Full gate: `npm run verify`

## Migration and rollback

State `None` when not applicable. Destructive migration is a hard stop.

## Prohibited changes / hard stops

List task-specific stops in addition to `AGENTS.md`.
