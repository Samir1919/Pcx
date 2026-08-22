# Task: API / Admin / Web Logic Alignment + Full Browser Verification (A→Z)

- Status: In progress
- Owner/agent: Cline
- Branch: `agent/fullstack-a-to-z-verify`
- Risk: Medium (Security-sensitive surfaces touched during read/verify)
- Related epic: E1–E19 cross-cutting verification
- Related ADRs: 0001, 0002, 0003, 0006 (and any ADR for modules touched)

## Objective

Unify API, admin-web, and customer-web logic, then verify every admin and web
function in a real browser in a human-like way (visit + use), fixing any error or
problem found and repeating until A→Z is clean.

## Source-of-truth references

- `AGENTS.md`
- `docs/brain/README.md`, `docs/agentic/PORTABLE_AGENT_WORKFLOW.md`
- `docs/specifications/USER_FLOW_SCREEN_MAP.md`
- `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`
- `docs/specifications/BUSINESS_PRODUCT_REQUIREMENTS.md`
- `docs/specifications/DATABASE_ERD.md`
- `docs/specifications/SECURITY_ARCHITECTURE.md`

## Scope

- Map every admin/web page → API client → API endpoint → backend module.
- Browser-verify every customer-web page (home, storefront, model, passport,
  sell, login, register, verify, merchant, listing) in a running local stack.
- Browser-verify every admin page (login+MFA, register, overview, catalog +
  model spec editor, inventory inspect modal, listings media modal, acquisition,
  shipment, returns, warranty, notifications, verification, payments credential
  save, users, footer, audit) authenticated.
- Fix any API↔UI logic mismatch server-authoritatively; verify invariants held.

## Non-scope

- Production deployment, destructive migrations, real provider credentials,
  secret rotation, test/security weakening, core invariant changes (hard stops).
- Real bKash HTTP/webhook, refund gateway execution, carrier pickup (sandbox only).

## Domain invariants affected

- None intentionally changed. Every fix must preserve: one-lifecycle identity,
  ProductModel ≠ InventoryItem, no double-sell, server-authoritative price/
  totals/role/status/grade/warranty, preserved inspection history, idempotent
  payment/refund/acquisition, safe public passport (no serial/cost/evidence).

## Acceptance criteria

- [ ] Phase A: stack + seed + baseline recorded; page→API→module map written.
- [ ] Phase B: every customer-web page verified (no pageerror/console.error/
      failed request/missing content beyond expected guest 401).
- [ ] Phase C: every admin page verified authenticated (same bar).
- [ ] Phase D: every discovered mismatch fixed server-authoritatively.
- [ ] Phase E: `npm run web:check`, `npm run verify` pass; merged to main with
      `merge-gate` OK; handoff + status updated.

## State/API/schema/UI impact

Determined per-fix. No unapproved schema change; additive migrations only if a
genuine bug requires and is within non-hard-stop scope.

## Security and privacy review

Auth/RBAC for each admin route, ownership for customer routes, server authority
for price/total/role/status/grade, public passport leak check, idempotency on
financial ops, no secrets in logs/artifacts.

## Test plan

- Baseline: `npm run verify:e0`, `npm test`.
- Per page: `npm run web:check -- --only web` / `--only admin`; Playwright MCP
  headed for interactive click-through.
- Full gate before completion: `npm run verify` + targeted integration tests.

## Migration and rollback

None unless a genuine bug requires an additive migration (non-destructive, no
hard-stop scope). File changes reversible via git.

## Prohibited changes / hard stops

As in `AGENTS.md` hard stops plus: no silent framework swap, no weakening of
web-check gate, no committing credentials, no multi-line shell strings.
