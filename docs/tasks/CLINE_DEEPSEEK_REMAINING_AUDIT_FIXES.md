# Remaining audit fixes for Cline/DeepSeek

Context: a full-project bug audit found ~30 issues. The tooling fixes (e0-check,
build-check, security-check timeouts) and the highest-severity commerce
security bugs (payment IDOR, non-atomic order creation, rollback masking) are
already fixed and committed/staged on branch `agent/stage3-completion`. The
items below are what's left. Do them ONE AT A TIME, each as its own small
commit, running `npm test` (not the full `npm run verify` chain) after each
before moving to the next. If any single item takes more than ~20 minutes or
you're unsure of the right fix, stop and report instead of guessing.

Read `AGENTS.md` first for the invariants and hard stops (never touch payment
provider credentials/production, never weaken tests/security).

## 1. Unbounded client-controlled reservation expiry (security)
File: `apps/api/src/modules/commerce/reservation-service.mjs`, `packages/domain/src/commerce/reservation.mjs`.
Problem: `reservedUntil` is accepted from client input; only checked to be
after `createdAt`, no max. A customer can lock an item until year 2999.
Fix: never accept `reservedUntil` from input. Derive it server-side as
`now + reservationWindowMs` (add a `reservationWindowMs` option, default
something sane like 15 minutes), matching how `trackingId`/`providerTransactionId`
are already server-derived elsewhere. Update tests.

## 2. TOCTOU race in sandbox payment/courier idempotency cache
File: `packages/domain/src/vendor/vendor-adapters.mjs` (~lines 98-110, 165-178).
Problem: `if (seen.has(ref)) return ...; await charge(...); seen.set(ref, result)`.
Two concurrent calls with the same reference both pass the `has` check before
either `set`s the cache, so both actually charge.
Fix: store the in-flight promise in the map immediately after the `has` check
(before awaiting the real charge), so the second caller awaits the same
in-flight promise instead of racing a second charge.

## 3. Double-charge risk: fresh gateway/idempotency cache per payment call
File: `apps/api/src/modules/commerce/order-payment-service.mjs`, `resolveGateway()`.
Problem: `createBkashGateway(...)` is constructed fresh on every `createPayment`
call, so its idempotency cache is always empty, and `paymentId`/`reference` is
a fresh `randomUUID()` per call. A client retry after a timeout generates a
new reference and a new real charge once a live provider is wired in.
Fix: require a caller-supplied idempotency key (or derive one from
`orderId` + amount) used as the charge reference, checked/deduped before
charging. Reuse one gateway instance across calls instead of building a new
one per request (e.g. cache by resolved credentials in `resolveGateway`).

## 4. Broken webhook retry (never actually retries in production SQL)
File: `apps/api/src/modules/logistics/postgres-shipment-repository.mjs`,
`markWebhookFailed`. Compare with `listPendingWebhookEvents` (only selects
`status = 'PENDING'`).
Problem: SQL unconditionally sets `status = 'FAILED'` on any failure, so a
webhook event is removed from the retry queue after the very first failure,
even though the caller (`shipment-service.mjs` `dispatchDueWebhookEvents`)
computes a backoff `nextAttemptAt` expecting more retries before
`maxWebhookRetries` is exhausted.
Fix: only set `status = 'FAILED'` when the retry budget is exhausted
(`nextAttemptAt IS NULL` or `retry_count >= max`); otherwise keep
`status = 'PENDING'` and just update `retry_count`/`next_attempt_at`. Fix the
existing unit test that currently mocks `markWebhookFailed` to just echo
`status: "FAILED"` (it masks this bug) — make it exercise the real branching.

## 5. No row-locking on webhook outbox dispatch (duplicate-processing risk)
File: same files as #4, `listPendingWebhookEvents` / `dispatchDueWebhookEvents`.
Problem: plain `SELECT ... WHERE status='PENDING'`, no `FOR UPDATE SKIP LOCKED`.
Two concurrent worker processes can fetch and process the same batch.
Fix: wrap the select in a transaction using `SELECT ... FOR UPDATE SKIP LOCKED`.

## 6. Payment credentials key silently falls back to an all-zero key
File: `apps/api/src/modules/payment/credentials-cipher.mjs` (~lines 13-24).
Problem: if `PAYMENT_CREDENTIALS_KEY` is unset, falls back to an all-zero key
with only a comment saying prod "must" set a real key — nothing enforces it.
Fix: throw at startup when `process.env.NODE_ENV === "production"` and the key
is absent/default.

## 7. No pg.Pool timeouts (requests/health checks can hang forever)
File: `apps/api/src/index.mjs`, `apps/api/src/infrastructure/database/migrate.mjs`
(wherever `new pg.Pool(...)` is constructed).
Problem: no `connectionTimeoutMillis` / `statement_timeout` set. If Postgres is
unreachable or a query hangs, any request handler — including
`/health/ready` — can hang indefinitely.
Fix: set `connectionTimeoutMillis` (e.g. 5000) and `statement_timeout` on the
pool; make the readiness check itself bounded with an explicit timeout.

## 8. Notifications never dispatch (no dispatcher wired in production runtime)
File: `apps/api/src/modules/identity/auth-runtime.mjs` (~line 100),
`apps/api/src/modules/notification/notification-service.mjs`.
Problem: `createNotificationService` is built with no `dispatchers`, defaults
to `{}`, so every channel lookup fails silently and notifications stay
PENDING forever regardless of environment.
Fix: inject real dispatchers in the runtime wiring (or, if intentionally a
no-op for now, say so explicitly in a comment instead of the misleading
current framing — confirm which with the human before choosing).

## 9. Worker swallows all tick errors silently
File: `apps/worker/src/worker.mjs` (~lines 12, 19-30), `apps/worker/src/main.mjs`.
Problem: default `onError = () => {}` and `main.mjs` never overrides it. Any
exception outside the per-item try/catch is silently discarded — worker can
stop making progress with no error trail.
Fix: pass `console.error` (at minimum) as `onError` in `main.mjs`; consider
exiting after N consecutive failures so a process manager restarts it.

## 10. apps/worker reaches directly into apps/api internals
File: `apps/worker/src/composition.mjs` (~lines 1-4).
Problem: relative imports straight into `../../api/src/modules/logistics/...`
instead of a shared `packages/*` boundary — any refactor of apps/api's
internal layout silently breaks the worker at runtime with no compile-time
signal.
Fix: move the shared services/repositories the worker needs into a package
both apps import (or add a smoke test that fails fast if this coupling
breaks).

## 11. Admin: silent infinite-loading hang on the verification page
File: `apps/admin/app/(workspace)/verification/page.js` (~lines 14-38).
Problem: the categories effect swallows every error (`.catch(() => {})`) and
never clears `loading` on failure; `load()` returns early without touching
`loading` when `categoryId` is falsy. If the categories fetch fails or
returns `[]`, the page is stuck forever on "Loading templates…" with no error
shown and the Refresh button disabled.
Fix: in the categories effect's catch, clear `loading` and show an error
state; ensure `load()` always resolves to a non-pending state even with zero
categories.

## 12. Admin: three divergent, duplicated CSRF/fetch wrappers
Files: `apps/admin/lib/api-client.js` (has the good `apiRequest`/`ApiError`),
`apps/admin/lib/catalog-api.js`, `apps/admin/lib/payment-api.js` (each hand-roll
their own `csrfToken()`/`request()`/error class instead of reusing
`api-client.js`).
Fix: make `catalog-api.js` and `payment-api.js` import and use
`apiRequest`/`ApiError` from `api-client.js` instead of duplicating the logic.
While there, reformat these two files out of their current single-line/minified
style into normal multi-line code (they're currently ~200-400 char lines,
unlike every other file in `lib/`, which is a real risk for diff-based edit
tools).

## 13. apps/web: dead nav link to a nonexistent `/catalog` route
Files: `apps/web/app/storefront/workspace.js` (~line 81),
`apps/web/app/passport/[pcxId]/page.js` (~line 34).
Problem: both render `<a href="/catalog">Catalog</a>`, but `/catalog` only
exists in `apps/admin`, not `apps/web` — clicking 404s.
Fix: remove the link, or point it at a real public route in `apps/web`.

## 14. apps/web: duplicated `money()` formatter
Files: `apps/web/app/storefront/workspace.js` (~lines 11-14),
`apps/web/app/passport/[pcxId]/page.js` (~lines 6-9) — identical currency
formatter copy-pasted in both.
Fix: extract to a shared `apps/web/lib/format.js` and import it in both places.

## 15. Missing error boundaries in both frontend apps
Problem: no `error.js` / `global-error.js` anywhere under `apps/admin/app` or
`apps/web/app`. An uncaught client-component exception blanks the page to
Next's generic overlay with no app context or retry path.
Fix: add `apps/admin/app/(workspace)/error.js` and `apps/web/app/error.js`
with a minimal retry UI.

## 16. Admin: no auth route guard, 401 handling duplicated 6×
Files: `apps/admin/app/(workspace)/layout.js`, `user-shell.js`, and every
workspace page (`page.js`, `catalog/workspace.js`, `inventory/page.js`,
`verification/page.js`, `payments/workspace.js`, `audit/page.js`).
Problem: `AuthProvider`'s `loading` flag is never consumed by the
layout/shell, so the full privileged shell renders before per-page 401
banners land; the same "Sign in to view X" logic is copied six times.
Fix: gate `WorkspaceLayout` on `identity`/`loading` from `AuthProvider`,
redirect unauthenticated users centrally instead of per-page.

## 17. Dead stub packages with zero real exports
Files: `packages/config/package.json`, `packages/testing/package.json`,
`packages/ui/package.json` — each is a one-line `package.json` only, no
`src/`, no `main`/`exports`, and nothing in the repo imports `@pcx/config`,
`@pcx/testing`, or `@pcx/ui`.
Fix: either flesh out with real `src/index.mjs` + `exports` (if they're
meant to hold something specific — check `docs/brain/` for intent first), or
remove them from the `workspaces` list in the root `package.json` until
populated. Do NOT remove without confirming they're not referenced from
`scripts/e0-check.mjs`'s required-artifacts list (they currently are — if you
remove the packages, update `e0-check.mjs` too, in the same commit).

---

Already fixed (do not redo, just be aware while touching neighboring code):
- `scripts/e0-check.mjs` now aggregates all missing files instead of throwing
  on the first one.
- `scripts/build-check.mjs` admin build now has `timeout`/`maxBuffer`/`stdio: "inherit"`.
- `scripts/security-check.mjs`'s `npm audit` step now has a timeout and treats
  network-unavailable errors as a safe skip instead of hanging/failing opaquely.
- `CLAUDE.md` no longer tells the agent to "execute" `START_PROMPT.md` literally.
- `order-payment-service.mjs` / `postgres-order-payment-repository.mjs`:
  `confirmPayment` now enforces order ownership (was an IDOR — any customer
  could confirm any other customer's payment); `createOrder` now inserts the
  order and all its items in one transaction via a new `createOrderWithItems`
  repository method (was non-atomic, could leave orphaned item-less orders);
  the transaction helper's rollback no longer masks the original error if the
  rollback itself throws.

Not fixed, flagged for a human decision (process/doc changes, not code bugs —
do not attempt these without asking first, they touch the agentic contract
itself):
- `AGENTS.md`'s "continuous-execution contract" has no concrete default stop
  condition, which can make a weaker model chain tasks until it exhausts
  context. Needs a human decision on what the default stop should be.
- `docs/status/PROJECT_STATUS.md` says "Stage 3 control plane complete" while
  `docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md` implies stages are strictly
  gated/cumulative — worth reconciling wording, but it's a documentation
  judgment call, not a bug.
