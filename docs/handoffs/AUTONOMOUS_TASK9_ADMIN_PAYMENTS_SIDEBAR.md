# Handoff: Task 9 — Link the /payments admin route from the sidebar

- Status: Complete
- Branch: agent/stage3-completion
- Date: 2026-08-17

## Outcome

The existing `/payments` admin workspace is now reachable from the sidebar. The
Catalog workspace nav and the Payments workspace nav both include a Payments link
(selected on the payments page). The Payments page itself (bKash sandbox/live
credential management, encrypted at rest) was already implemented in a prior slice.

## Changed areas

- `apps/admin/app/catalog/workspace.js` — added `<a href="/payments">Payments</a>`
  to the primary nav.
- `apps/admin/app/payments/workspace.js` — added the selected Payments link to the
  primary nav.

## Acceptance criteria

- [x] `/payments` is reachable from the admin sidebar from both workspaces.
- [x] The Payments link is marked selected on the payments page.
- [x] `npm run verify` passes: E0, lint, typecheck, 341 tests (319 pass, 0 fail,
      22 skipped), build (admin Next.js build), and security scan.

## Architecture

No backend change. This is a UI navigation-only slice; server-authoritative
credential handling and encryption remain unchanged.

## Schema

No schema change.

## Remaining

- Implement a real bKash HTTP adapter behind the injected payment gateway contract
  (a separate slice; real provider credentials remain a hard stop).
- Real container scanner (docker scout login or trivy) for an actual image report.

## Blockers

None.

## Verification

- `npm run verify` — 319 pass, 0 fail, 22 skipped; build + security pass.
