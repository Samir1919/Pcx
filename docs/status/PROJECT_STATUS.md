# PCX Project Status

- Updated: 2026-08-16
- Current main evidence commit: `39f71e6`
- Delivery target: tested, documented, GitHub-synced, staging-ready MVP
- Current engineering focus: Stage 2 completion and Stage 3 control-plane foundation
- Current autonomy maturity: Stage 2 in progress; Stage 3 foundation implementation in progress
- Production deployment: not authorized

This file is the central progress index. Approved specifications define what PCX must become; task files, handoffs, tests, migrations, and Git commits prove what is complete. Percentages are intentionally omitted because they are not reliable acceptance evidence.

## Epic status

| Epic | Status | Verified scope | Remaining critical scope |
|---|---|---|---|
| E0 — Repository & engineering foundation | Complete | Monorepo boundaries, Project Brain, portable agent rules, CI skeleton, local service definitions, verification commands | Controls continue evolving under Stage 2 |
| E1 — Identity, authentication & RBAC | In progress | Identity/RBAC contracts; auth/session and secure browser flows; audit/runtime/local limiter; contact/reset flows; privileged MFA gate and provider-neutral challenge verification; authenticated `/me`; ownership-safe authenticated address CRUD with origin/CSRF | Concrete MFA provider/enrollment; production delivery/distributed limits/atomic audit; admin user/role screens |
| E2 — Catalog & Product Model | In progress | Category/Brand/ProductModel contracts; typed specs; PostgreSQL persistence/runtime; audited admin catalog and typed specification-definition/value commands; responsive admin catalog and model-value UI; launch seeds and volume validation; safe typed specifications in public ProductModel detail | Sandbox search/listing and E8 storefront integration |
| E3 — Sell-to-PCX | In progress | Owner-scoped authenticated sell-request create/list/get/submit with server-owned DRAFT, ownership declaration, and DRAFT→SUBMITTED transition | Estimated range, admin queue, info/inspection/valuation/offer flows, media, notifications |
| E4 — Physical intake & inventory identity | In progress | Permission-gated physical intake as server-owned RECEIVED InventoryItem with normalized serial identifiers and database-enforced duplicate-identity rejection | Inspection/lifecycle transitions, PCX ID generation, cost allocation, listing |
| E5 — Inspection & verification | In progress | Versioned category-scoped inspection templates with typed, unique, canonical-code items created/read under SYSTEM_CONFIGURE | Inspection execution/results, health scores, evidence, immutable submissions, supervisor override |
| E6 — Acquisition, cost & final offer | In progress | Server-owned valuation range, final offer lifecycle (ACTIVE→ACCEPTED with expiry), immutable idempotent acquisition (agreedPrice derived from accepted offer), and server-owned acquisition payment transition (PENDING→PAID via `POST /api/v1/admin/acquisitions/:id/pay`) | Cost allocation, seller accept/reject endpoints, real payment gateway |
| E7 — Listing, pricing & passport | In progress | Server-owned listing lifecycle (DRAFT→PUBLISHED), versioned asking-price history, one-active-listing-per-item constraint, and safe public passport projection (`GET /passport/:pcxId`) excluding serial/cost/private evidence | Listing media/QR, reservation/sold transitions, disclosure completeness |
| E8 — Search, discovery & storefront | In progress | Public storefront listing search (`GET /api/v1/listings`) with allow-listed query params, cursor pagination, and safe disclosure-only listing cards (no serial/cost/private evidence); responsive storefront UI shell (`apps/web`) with category/brand filter, sort, cursor pagination, and public passport page | Listing media/QR, recommendation/dedicated search index |
| E9 — Cart, reservation & checkout | In progress | Bounded reservation with database-enforced one-active-per-item constraint (double-sell guard), customer-gated create/convert/read-active, and concurrency-proof integration | Cart persistence, order/payment allocation, reservation expiry job |
| E10 — Order & payment | In progress | Customer-gated order creation with server-computed totals and sold-fact snapshots, plus idempotent payments keyed by unique provider transaction id (confirm once from INITIATED) | Payment gateway/webhook integration, refunds, reconciliation |
| E11 — Fulfilment & shipment | In progress | Server-owned shipment lifecycle (DRAFT→SHIPPED→DELIVERED) with unique tracking id and persisted shipment events, gated by INVENTORY_MANAGE/SYSTEM_CONFIGURE | Courier sandbox adapter/webhook, packaging evidence media, return-to-origin |
| E12 — Return & refund | In progress | Customer-gated return request with server-owned REQUESTED→APPROVED→RECEIVED→REFUNDED lifecycle and database-enforced one-refundable-request-per-item (double-refund guard) | Refund gateway execution, physical serial-match intake, carrier pickup |
| E13 — Warranty & claims | In progress | One warranty per sold order item with a valid window, plus server-owned claim lifecycle (REQUESTED→RESOLVED) and typed resolutions (REPAIR/REPLACE/REFUND/REJECT) recorded with approving identity | Warranty policy authoring, claim inspections, carrier pickup, cost accounting |
| E14 — Admin operations & reporting | In progress | Admin-gated operations dashboard (`GET /api/v1/admin/reports/operations`) with lifecycle counts and recent orders/sell requests under AUDIT_READ/SYSTEM_CONFIGURE | Full BI/reporting UI, scheduled exports, per-module operational screens |
| E15 — Notifications | In progress | Provider-neutral notification outbox (PENDING→SENT/FAILED) with SYSTEM_CONFIGURE-gated creation and dispatch; delivery failure never rolls back a business transaction | Concrete email/SMS/push providers, retries, delivery visibility |
| E16 — Audit, observability & jobs | In progress | Append-only audit logs (`audit_logs`) with AUDIT_READ-gated filtered listing, plus existing notification `dispatchDue` as the jobs pattern; liveness/readiness endpoints | Full audit retention/rotation, BI dashboards, external SIEM |
| E17 — Security hardening | In progress | Baseline response security headers (`nosniff`, `DENY`, `no-referrer`, restrictive CSP) with regression coverage | Upload scanning, HSTS, CSP allowlisting for admin UI, MFA gates |
| E18 — Backup, staging & release readiness | In progress | Release preflight (`npm run release:preflight`) verifying staging/backup/restore artifacts and no placeholder secrets; runbook in handoff | Real production deployment and real secrets (hard stop) |

## Agentic maturity

| Stage | Status | Evidence / trigger |
|---|---|---|
| Stage 1 — Lean controlled development | Complete | Project Brain, hard stops, bounded branches/tasks, tests, review, handoffs and safe merge flow |
| Stage 2 — MVP integration/release discipline | In progress | Locked install, additive migrations, migration checksums, integration tests, CI PostgreSQL service, secret/dependency scanning, staging overlay, E2E smoke path, database backup/restore drill; container image scan and sandbox payment/courier/notification adapters remain |
| Stage 3 — Multi-agent control plane | Foundation implementation in progress | DAG/default-deny validation, an injected bounded local runner (retry, timeout, budget, cancellation, kill switch, artifact metadata), a deterministic parallel worktree planner with prefix-aware file/module/migration conflict detection, review/QA/security/integrated-verification/handoff adapters, and worktree create/remove/merge orchestration plus a parallel worker driver loop, a real shell git adapter (execFile, no shell interpolation, validated agent branches and `.worktrees/` paths), and a durable secret-free JSONL action/artifact log store with run-record mapping; vendor adapters and driver log wiring remain |

| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |


## Current verification baseline

- Root `npm test`: 240 total tests after shell-adapter/log-store coverage; 218 passed, 22 PostgreSQL integration tests skip without `TEST_DATABASE_URL` by design, 0 failed.
- Root `npm run verify`: pass with E0, lint, typecheck, 240 tests (218 pass, 22 PostgreSQL skips by design), build, secret scan, and dependency audit.
- CI-equivalent `npm run verify:ci`: 218 application/unit + 22 PostgreSQL integration + 1 E2E smoke, all passing (0 failures).
- E0 artifact verification: 36 required artifacts; latest GitHub merge evidence is PR #1 (`1692049`).
- Dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities.
- Backup/restore drill: seed rows recovered to a throwaway database.
- Latest detailed evidence: `docs/handoffs/STAGE3_SHELL_ADAPTERS_LOGS.md`.



## Current decisions and hard stops

- ADR 0001 modular monolith: Accepted.
- ADR 0002 PostgreSQL source of truth: Accepted.
- ADR 0003 server-side authentication boundary: Accepted.
- ADR 0005 Stage 3 policy-constrained control plane: Accepted for bounded local/CI implementation; hard stops unchanged.
- No current implementation blocker.
- Remaining hard stops: production deployment, destructive/irreversible migrations, production/customer-data deletion, real payment destinations/provider credentials, production secrets, test/security weakening, large framework replacement, or core invariant/source-of-truth changes.

## Next dependency-ready work

1. Wire the durable log store into the parallel worker driver so every run is persisted, and add vendor adapters (sandbox payment/courier/notification) behind the injected adapter contract.
2. Complete safe Stage 2 release slices: container image scan when an image exists, plus sandbox payment/courier/notification adapters.
3. Production deployment and real provider credentials remain human-approval hard stops.



## Update rule

Every material merge must update this file when it changes:

- epic/slice status;
- verified test or migration baseline;
- autonomy maturity stage;
- current blocker/hard stop;
- next dependency-ready work;
- main evidence commit after merge (or state that the merge commit must be filled by the next status-only update).

Detailed acceptance evidence belongs in the matching `docs/tasks/` and `docs/handoffs/` files.
