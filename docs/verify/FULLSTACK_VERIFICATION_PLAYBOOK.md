# Full-Stack Human-Like Verification Playbook (A→Z)

Tool-neutral, reusable procedure for verifying the whole platform like a human:
backend, admin web, and customer web as one system — nothing missed.

Use for any "verify like a human" / "verify the full project" request, and after
any cross-cutting slice touching backend + admin + web.

## 0. Baseline

- Confirm branch and clean working tree; record HEAD commit.
- Confirm the running stack (api/web/admin/postgres/redis/minio/worker) is healthy.
- Run the demo seed (idempotent).
- Record test counts and the current `docs/verify/browser-verify.json`.

## 1. Backend / domain gates

- `npm run verify:e0`, `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run build`, `npm run security`.
- `npm run test:integration` — MUST run, not skip (requires live Postgres).
- 12 domain invariants: unique lifecycle identity, `ProductModel` !=
  `InventoryItem`, no double-sell, server-authoritative
  price/totals/role/status/grade/warranty, preserved inspection history,
  privileged + reasoned + audited overrides, estimated ranges are not final
  offers, trade-in != new-sale accounting, order snapshots preserve sold facts,
  idempotent payment/refund/acquisition, private public passport, server-side
  state transitions + authorization.
- 7 state machines (inventory, sell-request, order, inspection, return,
  warranty-claim, payment): verify legal + illegal transition matrix.
- Negative/authorization matrix: 401 unauthenticated, 403 wrong role, IDOR
  404/403, invalid transition 409/422, and server ignores price/grade/role
  tamper.
- Concurrency (no double-sell) + idempotency replay (no double effect).
- Audit-trail live check + data-level passport privacy (no full serial,
  acquisition cost, or private evidence in the API response).
- Modular-monolith boundary: no module queries another module's tables.
- Worker coverage: health + async jobs (order-confirm, shipment->notification).

## 2. Track A — every API endpoint

- Enumerate every `*-http.mjs` route + method.
- Per endpoint: HTTP status contract, auth/RBAC, server-authoritative values,
  idempotency, and privacy.
- Diff `API_SPECIFICATION_STATE_MACHINES.md` vs code.

## 3. Track B — every admin section + subsection (headed browser)

Every admin route — including subsections and modals — opened and used in a
visible window.

## 4. Track C — every customer-web function (headed browser)

Every web route and function; loading/empty/error/conflict/recovery states
present (no fake success).

## 5. Track D — logic-exists-but-unimplemented gap analysis

`USER_FLOW_SCREEN_MAP.md` + `API_SPECIFICATION_STATE_MACHINES.md` vs
code/pages, both directions. Report; do not silently change.

## 6. Track E — industry-standard improvement backlog (report-only)

OpenAPI, contract tests, observability, idempotency-key header, rate limiting,
pagination metadata, role-based admin UI, CSV export, SEO/JSON-LD, Core Web
Vitals, WCAG 2.2, i18n, analytics, container scan, E2E in CI, coverage
threshold. Prioritize P0/P1/P2.

## 7. Cross-surface E2E (headed)

Sell-to-PCX (DRAFT -> SUBMITTED -> admin queue) and Buy + fulfilment
(order -> shipment -> ship -> deliver).

## 8. UI style guide + responsive + performance

`:root` tokens + `var(--...)`, `clamp()`, `auto-fit/minmax`, mobile-first, no
horizontal overflow at 320/375/768/1024, `var(--touch-target)`,
`:focus-visible`, `prefers-reduced-motion`, labeled forms. Lighthouse:
accessibility, Core Web Vitals (LCP <= 2.5s, INP <= 200ms, CLS <= 0.1), SEO,
best-practices.

## 9. Full gate

`npm run verify` (verify:e0 -> lint -> typecheck -> test -> build -> security ->
ui-guard). `docs/verify/browser-verify.json`: `headed: true`,
`result: "passed"`. `merge-gate` OK.

## 10. Report

Every line PASS/FAIL/N/A with evidence (file/selector/screenshot/command
output) + P0/P1/P2 improvement backlog.

## Resilience protocol

- No interactive shell; `--no-pager`/`--non-interactive`; no multi-line shell
  strings; timeouts + background `/tmp` logs.
- Browser: explicit timeouts, graceful fallback, cleanup.
- Fail-fast on critical gates; fail-continue on per-item checks.
- Checkpoint after each phase (`docs/handoffs/` + `PROJECT_STATUS`).
- Fix-loop: smallest fix -> affected gate only -> continue; risky/out-of-scope ->
  record and continue.
- Idempotent re-entry (idempotent seed + fresh E2E data).
- Self-monitor stack state.
