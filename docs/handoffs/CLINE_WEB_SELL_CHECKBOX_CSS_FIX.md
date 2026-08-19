# Agent Handoff: Web Sell Page Checkbox CSS Fix

- Status: Complete
- Branch: agent/public-quote-identity-reuse
- Latest commit: (set after commit)
- Date: 2026-08-19

## Outcome

1. The sell form (`/sell`) checkboxes were being styled as full-width text
   fields, which broke the layout on mobile and tablet. Checkboxes now render at
   a natural 20px control size with the brand accent color, and the
   `label.check` row keeps a 44px touch target.
2. On desktop the "Sell to PCX" page title sat centered in a 47.5rem column,
   so it started to the right of the full-width hero and entry grid below it.
   The title container is now left-aligned so it shares the same left edge as
   the hero, entry grid, and form.

## Changed areas

- `apps/web/app/globals.css`
  - Narrowed the `.sellForm input` text-field rule to
    `.sellForm input:not([type="checkbox"])` so checkboxes no longer get
    `width:100%`, big padding, and a 44px `min-height`.
  - Narrowed the matching focus rule the same way.
  - `label.check` now has `min-height: var(--touch-target)` and `cursor:pointer`.
  - Added a dedicated rule for `label.check input[type="checkbox"]`
    (20px box, `accent-color: var(--green)`, `flex-shrink:0`).
  - Changed `.sell` from `margin: 0 auto` to `margin: 0` so the title aligns
    left with the full-width hero and entry grid (max-width kept at 47.5rem).

## Acceptance criteria

- [x] Checkbox renders at ~20×20px (not a full-width input) on all viewports.
- [x] No horizontal overflow at 320 / 375 / 768 / 1024px.
- [x] Checkbox uses the brand accent color; focus/reduced-motion untouched.

## Verification

| Command/test | Result |
|---|---|
| `node scripts/web-check.mjs --only web` | Pass (3 pages, no client-side errors) |
| Playwright viewport probe 320/375/768/1024px | Pass (box 20×20, overflow none) |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Not run (CSS-only change; no build gate required by task) |

## Architecture/security review

CSS-only change. No domain invariants, authorization, pricing, or state-machine
behavior affected. No ADR required.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

- The `I confirm I own this item` checkbox in `apps/web/app/sell/page.js` still
  uses `checked readOnly`. In React, `readOnly` has no effect on a checkbox and
  it emits a console warning. Consider making it a controlled/disabled field in a
  follow-up. Out of scope for this CSS fix.

## Blockers requiring human decision

None.
