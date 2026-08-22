# Agent Handoff: CLINE_AUDIT_FIX_14 — Shared money() formatter

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: 5fb2256
- Date: 2026-08-17

## Outcome

The duplicate currency formatter is now a single `money()` in
`apps/web/lib/format.js`, imported by both storefront and passport pages.

## Changed areas

- `apps/web/lib/format.js` (new), `apps/web/app/storefront/workspace.js`,
  `apps/web/app/passport/[pcxId]/page.js`.

## Verification

| Command | Result |
|---|---|
| `npm test` | 338 pass, 22 skip, 0 fail |

## Remaining

- Item #15: error boundaries.
- Item #16: admin auth route guard.
- Item #17: dead stub packages.

## Blockers

Item #8 (dispatcher wiring) needs a human decision.
