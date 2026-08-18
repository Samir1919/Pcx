# PCX Project Status

- Updated: 2026-08-18
- Current main evidence commit: `51e7a26` (branch `agent/stage3-completion`; adds the admin workspace auth/navigation/seeded-data-views slice on top of full-stack Docker packaging and one-command dev/prod runners)
- Delivery target: tested, documented, GitHub-synced, staging-ready MVP
- Current engineering focus: Stage 3 control-plane completion and next dependency-ready work
- Current autonomy maturity: Stage 2 in progress; Stage 3 control plane complete for bounded local/CI parallel orchestration (ADR 0008)
- Production deployment: not authorized



This file is the central progress index. Approved specifications define what PCX must become; task files, handoffs, tests, migrations, and Git commits prove what is complete. Percentages are intentionally omitted because they are not reliable acceptance evidence.

## Epic status

| Epic | Status | Verified scope | Remaining critical scope |
|---|---|---|---|
| E0 — Repository & engineering foundation | Complete | Monorepo boundaries, Project Brain, portable agent rules, CI skeleton, local service definitions, verification commands | Controls continue evolving under Stage 2 |
| E1 — Identity, authentication & RBAC | In progress | Identity/RBAC contracts; auth/session and secure browser flows; audit/runtime/local limiter; contact/reset flows; privileged MFA gate and provider-neutral challenge verification; authenticated `/me`; ownership-safe authenticated address CRUD with origin/CSRF | Concrete MFA provider/enrollment; production delivery/distributed limits/atomic audit; admin user/role screens |
| E2 — Catalog & Product Model | In progress | Category/Brand/ProductModel contracts; typed specs; PostgreSQL persistence/runtime; audited admin catalog and typed specification-definition/value commands; responsive admin catalog and model-value UI with cursor-paginated product-model list; launch seeds and volume validation; safe typed specifications in public ProductModel detail | Sandbox search/listing and E8 storefront integration |
| E3 — Sell-to-PCX | In progress | Owner-scoped authenticated sell-request create/list/get/submit with server-owned DRAFT, ownership declaration, and DRAFT→SUBMITTED transition | Estimated range, admin queue, info/inspection/valuation/offer flows, media, notifications |
| E4 — Physical intake & inventory identity | In progress | Permission-gated physical intake as server-owned RECEIVED InventoryItem with normalized serial identifiers and database-enforced duplicate-identity rejection | Inspection/lifecycle transitions, PCX ID generation, cost allocation, listing |
| E5 — Inspection & verification | In progress | Versioned category-scoped inspection templates with typed, unique, canonical-code items created/read under SYSTEM_CONFIGURE | Inspection execution/results, health scores, evidence, immutable submissions, supervisor override |
| E6 — Acquisition, cost & final offer | In progress | Server-owned valuation range, final offer lifecycle (ACTIVE→ACCEPTED with expiry), immutable idempotent acquisition (agreedPrice derived from accepted offer), and server-owned acquisition payment transition (PENDING→PAID via `POST /api/v1/admin/acquisitions/:id/pay`) | Cost allocation, seller accept/reject endpoints, real payment gateway |
| E7 — Listing, pricing & passport | In progress | Server-owned listing lifecycle (DRAFT→PUBLISHED), versioned asking-price history, one-active-listing-per-item constraint, and safe public passport projection (`GET /passport/:pcxId`) excluding serial/cost/private evidence; public passport now returns a populated object for published items (snake→camel mapping fix); admin listing management workspace + `GET /api/v1/admin/listings` (draft create, publish, price set) | Listing media/QR, reservation/sold transitions, disclosure completeness |
| E8 — Search, discovery & storefront | In progress | Public storefront listing search (`GET /api/v1/listings`) with allow-listed query params, cursor pagination, and safe disclosure-only listing cards (no serial/cost/private evidence); responsive storefront UI shell (`apps/web`) with category/brand filter, sort, cursor pagination, and public passport page | Listing media/QR, recommendation/dedicated search index |
| E9 — Cart, reservation & checkout | In progress | Bounded reservation with database-enforced one-active-per-item constraint (double-sell guard), customer-gated create/convert/read-active, and concurrency-proof integration | Cart persistence, order/payment allocation, reservation expiry job |
| E10 — Order & payment | In progress | Customer-gated order creation with server-computed totals and sold-fact snapshots, plus idempotent payments keyed by a server-authoritative provider transaction id derived from the injected sandbox payment gateway (confirm once from INITIATED); admin panel stores sandbox/live bKash credentials encrypted at rest (AES-256-GCM) and switches the active mode, and the payment service builds a bKash gateway from the active credentials (falling back to sandbox) | Real bKash HTTP adapter/webhook integration, refunds, reconciliation |


| E11 — Fulfilment & shipment | In progress | Server-owned shipment lifecycle (DRAFT→SHIPPED→DELIVERED→RETURNED) with unique tracking id and persisted shipment events, gated by INVENTORY_MANAGE/SYSTEM_CONFIGURE; tracking id is server-authoritative, derived from the injected sandbox courier; signed courier webhook (`POST /api/v1/webhooks/courier`) advances DELIVERED/RETURNED with timing-safe secret validation and idempotent final-state handling; durable courier webhook outbox (`shipment_webhook_events`) enqueues every webhook before application and a worker job (`dispatchDueWebhookEvents`) retries PENDING events with a bounded backoff budget until APPLIED or FAILED | Packaging evidence media, return-to-origin |



| E12 — Return & refund | In progress | Customer-gated return request with server-owned REQUESTED→APPROVED→RECEIVED→REFUNDED lifecycle and database-enforced one-refundable-request-per-item (double-refund guard) | Refund gateway execution, physical serial-match intake, carrier pickup |
| E13 — Warranty & claims | In progress | One warranty per sold order item with a valid window, plus server-owned claim lifecycle (REQUESTED→RESOLVED) and typed resolutions (REPAIR/REPLACE/REFUND/REJECT) recorded with approving identity | Warranty policy authoring, claim inspections, carrier pickup, cost accounting |
| E14 — Admin operations & reporting | In progress | Admin-gated operations dashboard (`GET /api/v1/admin/reports/operations`) with lifecycle counts and recent orders/sell requests under AUDIT_READ/SYSTEM_CONFIGURE; admin listing management screen | Full BI/reporting UI, scheduled exports, per-module operational screens |
| E15 — Notifications | In progress | Provider-neutral notification outbox (PENDING→SENT/FAILED) with SYSTEM_CONFIGURE-gated creation and dispatch; delivery failure never rolls back a business transaction | Concrete email/SMS/push providers, retries, delivery visibility |
| E16 — Audit, observability & jobs | In progress | Append-only audit logs (`audit_logs`) with AUDIT_READ-gated filtered listing, plus existing notification `dispatchDue` as the jobs pattern; liveness/readiness endpoints | Full audit retention/rotation, BI dashboards, external SIEM |
| E17 — Security hardening | In progress | Baseline response security headers (`nosniff`, `DENY`, `no-referrer`, restrictive CSP) with regression coverage | Upload scanning, HSTS, CSP allowlisting for admin UI, MFA gates |
| E18 — Backup, staging & release readiness | In progress | Release preflight (`npm run release:preflight`) verifying staging/backup/restore artifacts and no placeholder secrets; runbook in handoff | Real production deployment and real secrets (hard stop) |

## Agentic maturity

| Stage | Status | Evidence / trigger |
|---|---|---|
| Stage 1 — Lean controlled development | Complete | Project Brain, hard stops, bounded branches/tasks, tests, review, handoffs and safe merge flow |
| Stage 2 — MVP integration/release discipline | In progress | Locked install, additive migrations, migration checksums, integration tests, CI PostgreSQL service, secret/dependency scanning, staging overlay, E2E smoke path, database backup/restore drill, and a container image scan (`scripts/container-scan.mjs`) that runs when an image exists and skips safely otherwise; sandbox payment/courier/notification adapters remain |
| Stage 3 — Multi-agent control plane | Complete for bounded local/CI parallel orchestration (ADR 0008) | DAG/default-deny validation, an injected bounded local runner (retry, timeout, budget, cancellation, kill switch, artifact metadata), a deterministic parallel worktree planner with prefix-aware file/module/migration conflict detection, review/QA/security/integrated-verification/handoff adapters, and worktree create/remove/merge orchestration plus a parallel worker driver loop that persists every run to a durable secret-free JSONL log, a real shell git adapter (execFile, no shell interpolation, validated agent branches and `.worktrees/` paths, plus branch deletion after merge and a safe `commit` method that rejects multi-line messages to prevent a shell hang), and a durable secret-free JSONL action/artifact log store with run-record mapping, and deterministic secret-free sandbox vendor adapters (notification dispatcher, idempotent payment gateway, courier) behind injected provider-neutral contracts; the payment and courier adapters are wired into the commerce and logistics services (server-authoritative provider transaction id and tracking id); a runnable autonomous orchestration loop driver (`scripts/autonomous-loop.mjs`) that loads a bounded task graph, runs every dependency-ready task through the full pipeline with the real shell git adapter and durable log store, persists completed/failed task status back to the graph file for cross-process resume, and reports a durable summary (dry-run mode is CI-safe); stuck-state hardening now adds durable transitive `BLOCKED` propagation, in-loop batch limits, explicit integration-target checkout, merge-conflict abort, cleanup-failure reporting, durable `PASSED` resume, real merge/worktree failure records, and merged-branch deletion; a vendor-neutral external-agent executor contract (ADR 0007) with default-deny and secret-rejection validation is approved and implemented; the loop now surfaces a per-run cost/runtime/retry report (`summarizeRuns`), enforces an explicit approval boundary (`approvalBoundary`) that blocks unapproved commit-creating actions with `approval_required`, and demonstrates a real (non-noop) vendor-neutral executor (`createRealExecutor`) that writes a verifiable marker artifact under `.worktrees/executor-output/`; Stage 3 entry evidence recorded in ADR 0008 |










| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |


## Current verification baseline

- Root `npm test`: 397 total, 375 pass, 0 fail, 22 skipped (DB integration) after the admin listing management slice.
- Root `npm run verify`: pass for this slice: E0, lint, typecheck, tests, build, and security scan (secrets + dependencies + container).
- CI-equivalent `npm run verify:ci`: application/unit + PostgreSQL integration + E2E smoke, all passing (0 failures).
- E0 artifact verification: 36 required artifacts; latest GitHub merge evidence is PR #1 (`1692049`).
- Dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities.
- Backup/restore drill: seed rows recovered to a throwaway database.
- Autonomous loop dry-run: `node scripts/autonomous-loop.mjs --dry-run --real-executor --no-persist-graph` completes spec/api/web with a surfaced cost/runtime report (Tasks 3, Passed 3, Cost 3); `--approval-required` blocks commit-creating tasks with `approval_required`; `--deepseek-executor` and `--openai-review` opt into AI-backed adapters.
- Latest detailed evidence: `docs/handoffs/ADMIN_WORKSPACE_AUTH_AND_NAV.md` (commit `51e7a26`), plus `STAGE3_AI_EXECUTOR_REVIEWER_ADAPTERS.md`, `AUTONOMOUS_TASK5_BKASH_CREDENTIALS_ADMIN.md`, `STAGE3_INTEGRATION_TARGET_FIX.md`, `FULLSTACK_DOCKER_DEV_PROD_RUNNERS.md`, `CLINE_DEEPSEEK_UNBLOCK_CATALOG_PAGINATION.md` (commits `eef8f82`, `da18256`, `494f311`; DeepSeek endpoint env-driven + leaked-tool-call fail-fast + admin product-model cursor pagination), `CLINE_AUDIT_FIX_18_PASSPORT_SNAKE_MAPPING.md` (public passport snake→camel mapping so a published item no longer 404s), and `CLINE_AUDIT_FIX_19_PAYMENT_SAVE_ACTIVE.md` (commit `559bfda`; credential save preserves server-owned active state).














## Current decisions and hard stops

- ADR 0001 modular monolith: Accepted.
- ADR 0002 PostgreSQL source of truth: Accepted.
- ADR 0003 server-side authentication boundary: Accepted.
- ADR 0005 Stage 3 policy-constrained control plane: Accepted for bounded local/CI implementation; hard stops unchanged.
- ADR 0006 server-authoritative gateway-derived provider transaction id: Accepted.
- ADR 0007 vendor-neutral external-agent executor contract: Accepted (default-deny, secret-rejection validation).
- ADR 0008 Stage 3 entry evidence and control-plane completion: Accepted (records trigger evidence, capabilities, cost/owner, rollout/rollback, success metrics, and manual controls).
- ADR 0009 AI-backed executor and reviewer adapters: Accepted (opt-in DeepSeek executor and OpenAI reviewer wired via `--deepseek-executor`/`--openai-review`; secrets never in source/logs/artifacts; review gate cannot be weakened).
- No current implementation blocker.




- Remaining hard stops: production deployment, destructive/irreversible migrations, production/customer-data deletion, real payment destinations/provider credentials, production secrets, test/security weakening, large framework replacement, or core invariant/source-of-truth changes.

## Next dependency-ready work

1. Install/authenticate a real container scanner (docker scout login or trivy) to produce an actual image vulnerability report.
2. Implement a real bKash HTTP adapter behind the injected gateway contract (sandbox-only until real credentials are approved).
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
