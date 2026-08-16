# ADR 0004: Next.js admin web boundary

- Status: Accepted
- Date: 2026-08-16

## Context

The approved product specification requires a responsive Next.js web/PWA and the infrastructure specification reserves `apps/admin` for privileged admin and technician concerns. E2 now has protected catalog APIs and needs its first real administrative interface.

## Decision

Implement `apps/admin` as an independent Next.js application using React. Lock the initial runtime to Next.js 16.3.1 and React 19.2.8. Browser requests use same-origin `/api` paths, forwarded by a server-side rewrite to the configured `PCX_API_ORIGIN`.

The client is never an authorization boundary. Secure cookies, RBAC, validation, lifecycle ownership and audit remain enforced by the API. Shared visual primitives may move into `packages/ui` when reuse is evidenced; this first bounded screen remains local to the admin application.

## Approval

Accepted from the approved Business Product Requirements (Next.js responsive web/PWA) and Infrastructure/DevOps application boundary specifications. This does not authorize production deployment or weaken the API security boundary.

## Consequences

- Admin production builds are part of the root build gate.
- Framework dependencies are exact in the lockfile and audited with the repository dependency gate.
- Environment ingress must configure an exact API origin and allowed browser origin.
- Authentication screens, CSP/security headers, offline PWA behavior and hosting remain later bounded work.
