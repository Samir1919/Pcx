# Browser verification evidence

A slice that changes a browser-facing page or flow in `apps/web` or `apps/admin`
(excluding tests and static config) must leave a committed
`docs/verify/browser-verify.json` record produced by a real, **headed** browser
run. The gate `npm run ui-guard` (wired into `npm run verify`) rejects a slice
that changed UI files without valid evidence.

## Rules

- The record is machine-checked. Hand-writing a `"headed": true` field is not
  enough: the record must describe an actual human-like click-through of the
  full start-to-end business flow for the changed surface.
- `headed` must be `true`. Use `PCX_HEADED=1` with the script below, or the
  Playwright MCP browser running headed (visible window). `npm run web:check`
  is intentionally headless and does **not** satisfy this requirement.
- `result` must be `"passed"`. A failed or blocked run leaves evidence for
  diagnostics but cannot satisfy the gate.

## Schema

```json
{
  "scope": "short description of the changed surface",
  "headed": true,
  "tool": "scripts/business-e2e-check.mjs",
  "result": "passed",
  "businessFlow": {
    "subject": "what business flow was exercised",
    "steps": ["step 1", "step 2", "..."]
  },
  "notes": "optional detail",
  "ranAt": "2026-08-25T15:00:00.000Z"
}
```

## Producing evidence

Run the appropriate flow headed with `--evidence` to write the record
automatically:

```bash
PCX_HEADED=1 node scripts/business-e2e-check.mjs --evidence
PCX_HEADED=1 node scripts/admin-e2e-check.mjs --evidence
PCX_HEADED=1 node scripts/storefront-e2e-check.mjs --evidence
```

For flows that need manual judgment, use the Playwright MCP browser headed and
write the equivalent record (or call the shared writer).

The evidence file is committed alongside the slice. A later slice that changes
the same surface overwrites it with a fresh record; a slice that touches no UI
surface does not require it.
