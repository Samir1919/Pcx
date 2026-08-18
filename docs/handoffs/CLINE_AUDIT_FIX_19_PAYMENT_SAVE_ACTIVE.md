# Agent Handoff: CLINE_AUDIT_FIX_19 — Payment save no longer deactivates active credential

- Status: Complete
- Branch: `agent/admin-ui-responsive-fixes`
- Date: 2026-08-18

## Outcome

`saveConfig` no longer accepts a client-supplied `active` field and instead preserves
server-owned activation state: an existing config keeps its current `active` flag on
re-save, and a brand-new config stays inactive until explicitly activated via
`setActiveMode`. The admin Payments page no longer sends `active: false` on save.

## Changed areas

- `apps/api/src/modules/payment/payment-provider-config-service.mjs`: `saveConfig`
  whitelist is now `provider/mode/credentials` (drops `active`); `active` is derived
  server-side as `existing.active` for updates or `false` for new records.
- `apps/admin/app/(workspace)/payments/workspace.js`: save payload is
  `{ mode, credentials }` (dropped `active: false`).
- `apps/api/test/payment-provider-config-service.test.mjs`: two regression tests —
  rejects a client-supplied `active`, and preserves active state on re-save.

## Acceptance criteria

- [x] Sending `active` in save input is rejected.
- [x] Re-saving an active config preserves its active state.
- [x] Brand-new configs remain inactive after save.
- [x] Existing + new tests pass.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/api/test/payment-provider-config-service.test.mjs apps/api/test/payment-provider-config-http.test.mjs` | 14/14 pass |
| `npm run verify` | Pass (393 tests: 371/0/22 skipped; build + security green) |

## Architecture/security review

This strengthens an existing invariant ("client input never authoritatively sets
active") rather than changing it. No new exposure; the masked credentials projection
is unchanged. No ADR required.

## Remaining work / next safe action

- Real bKash HTTP adapter behind the injected gateway contract (sandbox-only) remains
  dependency-ready.

## Blockers requiring human decision

None.
