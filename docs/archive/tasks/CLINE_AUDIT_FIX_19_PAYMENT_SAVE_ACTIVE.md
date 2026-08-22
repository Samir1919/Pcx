# Task: Fix payments save silently deactivating the active credential

- Status: Complete
- Branch: `agent/admin-ui-responsive-fixes`

## Objective

The admin Payments page saves credentials with `active: false` hardcoded, and the
server accepted a client-supplied `active` flag. Re-saving the currently-active
sandbox/live credential therefore silently deactivated it — violating the invariant
"Client input never authoritatively sets active" and leaving the payment service
with no active credential until an admin re-activated it.

## Scope

- Server: `saveConfig` no longer accepts an `active` field (rejects it as
  `invalid_input`); activation is server-owned and changes only through
  `setActiveMode`. An existing config keeps its current active state on save; a
  brand-new config stays inactive until explicitly activated.
- Frontend: `payments/workspace.js` stops sending `active` on save.

## Non-scope

- No real bKash adapter, no credential storage changes, no activation flow changes.

## Hard stops

None touched. No production, credentials/destination, security, or invariant changes.

## Acceptance criteria

- Sending `active` in `saveConfig` input is rejected.
- Re-saving an active config preserves its active state.
- Brand-new configs remain inactive after save.
- Existing payment provider config tests + new regression tests pass.
