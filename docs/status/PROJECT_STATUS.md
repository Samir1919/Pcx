# PCX Project Status

- Updated: 2026-08-23
- Current main evidence commit: `40204ab` on branch `main`-bound `agent/dev-docker-node24` (dev Docker-first + Node 24 LTS + scheduled backlog); final status-only commit pending merge
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
| E2 — Catalog & Product Model | In progress | Category/Brand/ProductModel contracts; typed specs; PostgreSQL persistence/runtime; audited admin catalog and typed specification-definition/value commands; responsive admin catalog and model-value UI with cursor-paginated product-model list; full-field edit modal (createPortal) for categories/brands/models/definitions; launch seeds and volume validation; safe typed specifications in public ProductModel detail | Sandbox search/listing and E8 storefront integration |
| E3 — Sell-to-PCX | In progress | Owner-scoped authenticated sell-request create/list/get/submit with server-owned DRAFT, ownership declaration, DRAFT→SUBMITTED transition (web "Submit" now autosaves then submits), and sell-entry/build-component model (Desktop PC, PC Parts, Laptop, Laptop Parts); catalog taxonomy (`PC Parts`/`Laptop Parts` parent groups); public 4-entry sell flow with component build wizard and live indicative quote range (`GET /api/v1/quote-ranges`); admin-set server-owned indicative prices (`POST /api/v1/admin/indicative-prices`); admin sell-request queue excludes DRAFT + admin detail view (`GET /api/v1/admin/sell-requests/:id`); seller "My sell requests" view with status timeline + active offer Accept/Decline; profile autosave of sell-form name/phone | Admin indicative-price UI, media enhancement, notifications |
| E4 — Physical intake & inventory identity | In progress | Permission-gated physical intake as server-owned RECEIVED InventoryItem with database-enforced duplicate-identity rejection; server-derived human-readable PCX ID (`PCX-########`) generated from the item UUID (never client-authored); approved inspections record condition_grade + current_health_score + approved_at onto the item | Cost allocation, warehouse/stock movement, full lifecycle UI |
| E5 — Inspection & verification | In progress | Versioned category-scoped inspection templates with typed, unique, canonical-code items created/read under SYSTEM_CONFIGURE; admin inspection template create form; technician inspection execution (`/api/v1/inspections` → start DRAFT, PUT results, submit) with server-derived rule-based health score (critical=3× weight), suggested grade (A_PLUS/A/B/C/REJECT), mandatory-test enforcement, SUBMITTED/ESCALATED state, supervisor approve/reject recording grade/health onto the inventory item, admin inventory "Inspect" modal, and inspection evidence upload (`POST /api/v1/inspections/:id/media`, PRIVATE, technician-gated) | Reinspection/supersede, reasoned supervisor override (critical-fail), autosave |
| E6 — Acquisition, cost & final offer | In progress | Server-owned valuation range, final offer lifecycle (ACTIVE→ACCEPTED/REJECTED with expiry), seller-owned public accept/reject endpoints (`POST /api/v1/offers/:id/accept` and `/reject`, ownership enforced), immutable idempotent acquisition (agreedPrice derived from accepted offer), and server-owned acquisition payment transition (PENDING→PAID via `POST /api/v1/admin/acquisitions/:id/pay`); admin acquisition workflow workspace | Cost allocation (item_costs), real payment gateway |
| E7 — Listing, pricing & passport | In progress | Server-owned listing lifecycle (DRAFT→PUBLISHED→RESERVED), versioned asking-price history, one-active-listing-per-item constraint, and safe public passport projection (`GET /passport/:pcxId`) excluding serial/cost/private evidence; public listing cards + passport now surface the server-derived condition grade and health score for published items; admin listing management workspace + `GET /api/v1/admin/listings` (draft create, publish, price set); listing photo upload (`POST /api/v1/admin/listings/:id/media`, PUBLIC, admin-gated); order creation atomically moves the sellable listing PUBLISHED→RESERVED so a purchased item is no longer public/buyable | Listing QR, RESERVED→SOLD on payment confirm, verification summary |
| E8 — Search, discovery & storefront | In progress | Public storefront listing search (`GET /api/v1/listings`) with allow-listed query params, cursor pagination, and safe disclosure-only listing cards (no serial/cost/private evidence); responsive storefront UI shell (`apps/web`) with category/brand filter, sort, cursor pagination, and public passport page | Listing media/QR, recommendation/dedicated search index |
| E9 — Cart, reservation & checkout | In progress | Bounded reservation with database-enforced one-active-per-item constraint (double-sell guard), customer-gated create/convert/read-active, concurrency-proof integration, a worker background job (`expireDue`) that expires passed ACTIVE reservations, and persistent customer carts (`/api/v1/cart` add/get/remove) with server-owned price snapshot from the published listing; order creation consumes the ACTIVE reservation exactly once (ACTIVE→CONVERTED) and claims the listing atomically, so the DB is the final authority against double-selling | RESERVED→SOLD on payment confirm, order/payment allocation of shipping/tax |
| E10 — Order & payment | In progress | Customer-gated order creation with server-computed totals and sold-fact snapshots; idempotent payments with server-derived provider transaction ids; COD (Cash on Delivery) as a first-class, gateway-free, idempotent payment method (stays INITIATED until delivery collection); bKash via the injected sandbox gateway with server-authoritative provider identity; admin panel stores sandbox/live bKash credentials encrypted at rest (AES-256-GCM) | Real bKash HTTP adapter/webhook integration, refunds, reconciliation |


| E11 — Fulfilment & shipment | In progress | Server-owned shipment lifecycle (DRAFT→SHIPPED→DELIVERED→RETURNED) with unique tracking id and persisted shipment events, gated by INVENTORY_MANAGE/SYSTEM_CONFIGURE; tracking id is server-authoritative, derived from the injected sandbox courier; signed courier webhook (`POST /api/v1/webhooks/courier`) advances DELIVERED/RETURNED with timing-safe secret validation and idempotent final-state handling; durable courier webhook outbox (`shipment_webhook_events`) enqueues every webhook before application and a worker job (`dispatchDueWebhookEvents`) retries PENDING events with a bounded backoff budget until APPLIED or FAILED; admin shipment management workspace with read-only shipment list | Packaging evidence media, return-to-origin |



| E12 — Return & refund | In progress | Customer-gated return request with server-owned REQUESTED→APPROVED→RECEIVED→REFUNDED lifecycle and database-enforced one-refundable-request-per-item (double-refund guard); physical serial-match enforced on return intake (received serial must equal the sold unit's primary serial, normalized); admin return & refund management workspace with read-only return list | Refund gateway execution (sandbox), carrier pickup |
| E13 — Warranty & claims | In progress | One warranty per sold order item with a valid window, server-owned claim lifecycle (REQUESTED→RESOLVED) with typed resolutions (REPAIR/REPLACE/REFUND/REJECT), and customer-owned public claim creation (`POST /api/v1/claims`, ownership enforced); admin warranty & claims management workspace with read-only warranty and claim lists | Warranty policy authoring, claim inspections, carrier pickup, cost accounting |
| E14 — Admin operations & reporting | In progress | Admin-gated operations dashboard (`GET /api/v1/admin/reports/operations`) with lifecycle counts and recent orders/sell requests under AUDIT_READ/SYSTEM_CONFIGURE; admin operational workspaces (listing, acquisition, shipment, return, warranty, notifications) | Full BI/reporting UI, scheduled exports, per-module operational screens |
| E15 — Notifications | In progress | Provider-neutral notification outbox (PENDING→SENT/FAILED) with SYSTEM_CONFIGURE-gated creation and dispatch; delivery failure never rolls back a business transaction; admin notification create workspace with read-only notification list; EMAIL (Resend) + SMS (bdBulksms) provider credential config in admin (masked, encrypted, sandbox/live activation); synchronous contact delivery for verify/reset OTP; deterministic event emitter + idempotent outbox with ORDER_PLACED/OFFER_CREATED/SELL_REQUEST_SUBMITTED emits; worker resolves admin-configured dispatchers; storefront IntlPhoneInput (all countries, default BD +880) + mirrored client-side email/phone validation on login/register/verify/account/sell | Shipment/order-delivery customer-resolve emit, provider-based MFA, real provider activation |
| E16 — Audit, observability & jobs | In progress | Append-only audit logs (`audit_logs`) with AUDIT_READ-gated filtered listing and best-effort critical-action writes (listing publish, price change, inspection approve/reject); no auto-delete retention; liveness/readiness endpoints | BI dashboards, external SIEM |
| E17 — Security hardening | In progress | Baseline response security headers (`nosniff`, `DENY`, `no-referrer`, restrictive CSP) with regression coverage | Upload scanning, HSTS, CSP allowlisting for admin UI, MFA gates |
| E18 — Backup, staging & release readiness | In progress | Release preflight (`npm run release:preflight`) verifying staging/backup/restore artifacts and no placeholder secrets; runbook in handoff | Real production deployment and real secrets (hard stop) |
| E19 — Media & evidence | In progress | Local/NFS-backed image media module (`MEDIA_ROOT`-driven, default `apps/api/uploads`); `media` + link tables (`sell_request_media`, `inspection_media`, `listing_media`); storage adapter with magic-byte MIME allow-list, 5 MiB limit, server-generated keys, path-traversal guard; public/private visibility access control; multiple-image client upload UI (admin listing "Photos" modal, sell-request "Item photos", inspection "Evidence" file input) with real-browser checks | S3/MinIO swap, malware scan integration |

## Agentic maturity

| Stage | Status | Evidence / trigger |
|---|---|---|
| Stage 1 — Lean controlled development | Complete | Project Brain, hard stops, bounded branches/tasks, tests, review, handoffs and safe merge flow |
| Stage 2 — MVP integration/release discipline | In progress | Locked install, additive migrations, migration checksums, integration tests, CI PostgreSQL service, secret/dependency scanning, staging overlay, E2E smoke path, database backup/restore drill, and a container image scan (`scripts/container-scan.mjs`) that runs when an image exists and skips safely otherwise; sandbox payment/courier/notification adapters remain |
| Stage 3 — Multi-agent control plane | Complete for bounded local/CI parallel orchestration (ADR 0008) | DAG/default-deny validation, an injected bounded local runner (retry, timeout, budget, cancellation, kill switch, artifact metadata), a deterministic parallel worktree planner with prefix-aware file/module/migration conflict detection, review/QA/security/integrated-verification/handoff adapters, and worktree create/remove/merge orchestration plus a parallel worker driver loop that persists every run to a durable secret-free JSONL log, a real shell git adapter (execFile, no shell interpolation, validated agent branches and `.worktrees/` paths, plus branch deletion after merge and a safe `commit` method that rejects multi-line messages to prevent a shell hang), and a durable secret-free JSONL action/artifact log store with run-record mapping, and deterministic secret-free sandbox vendor adapters (notification dispatcher, idempotent payment gateway, courier) behind injected provider-neutral contracts; the payment and courier adapters are wired into the commerce and logistics services (server-authoritative provider transaction id and tracking id); a runnable autonomous orchestration loop driver (`scripts/autonomous-loop.mjs`) that loads a bounded task graph, runs every dependency-ready task through the full pipeline with the real shell git adapter and durable log store, persists completed/failed task status back to the graph file for cross-process resume, and reports a durable summary (dry-run mode is CI-safe); stuck-state hardening now adds durable transitive `BLOCKED` propagation, in-loop batch limits, explicit integration-target checkout, merge-conflict abort, cleanup-failure reporting, durable `PASSED` resume, real merge/worktree failure records, and merged-branch deletion; a vendor-neutral external-agent executor contract (ADR 0007) with default-deny and secret-rejection validation is approved and implemented; the loop now surfaces a per-run cost/runtime/retry report (`summarizeRuns`), enforces an explicit approval boundary (`approvalBoundary`) that blocks unapproved commit-creating actions with `approval_required`, and demonstrates a real (non-noop) vendor-neutral executor (`createRealExecutor`) that writes a verifiable marker artifact under `.worktrees/executor-output/`; Stage 3 entry evidence recorded in ADR 0008 |










| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |


## Current verification baseline

- Root `npm test`: 547 total, 521 pass, 0 fail, 26 skipped (DB integration) after the storefront IntlPhoneInput slice.
- Root `npm run verify`: pass: E0, lint, typecheck, tests, build, and security scan (secrets + dependencies + container).
- CI-equivalent `npm run verify:ci`: application/unit + PostgreSQL integration + E2E smoke, all passing (0 failures).
- E0 artifact verification: 33 required artifacts (3 unused package stubs removed); latest GitHub merge evidence is PR #1 (`1692049`).
- Dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities.
- Backup/restore drill: seed rows recovered to a throwaway database.
- Autonomous loop dry-run: `node scripts/autonomous-loop.mjs --dry-run --real-executor --no-persist-graph` completes spec/api/web with a surfaced cost/runtime report (Tasks 3, Passed 3, Cost 3); `--approval-required` blocks commit-creating tasks with `approval_required`; `--deepseek-executor` and `--openai-review` opt into AI-backed adapters.
- Latest: merge `1c0bb4b` completed the Sell-to-PCX seller/admin UX (A→D): real web submit (DRAFT→SUBMITTED), admin queue excludes DRAFT + admin detail view, seller "My sell requests"/offer Accept-Decline, and self-service profile edit + password change with sell-form name/phone autosave (534 tests / 0 fail; headed business-e2e 11/11). Prior: merge `fe84344` enforced the double-sell guard; `9492775` added `business-e2e`/`shipment-flow` checks; `b52d0a3` synced the stale migrations test; `FULLSTACK_A_TO_Z_VERIFY.md` built `storefront-e2e`/`admin-e2e`.
- Admin manual-to-automation slices (commits `33eb30f`…`25979e4`, docs commit `3bef1eb`): returns/warranty/shipment row actions + acquisition contextual prefill; offer-expiry and warranty-window defaults; inspection-template autoselect + listing slug prefill; overview/audit 30s polling; verification template version auto-increment. Headed `admin-e2e` grown from 21→25 steps, all pass; `npm run verify` pass (534 tests / 0 fail).
- Unified contact delivery + notification (commit `c680817`): contact normalization + per-contact abuse control; EMAIL/SMS provider config + dispatchers (Resend/bdBulksms); synchronous verify/reset delivery; event emitter + idempotent outbox + lifecycle emits + worker configured dispatch; admin Providers tab. Headed `admin-e2e` 26/26; `npm run verify` pass (543 tests / 517 pass / 0 fail / 26 skipped). Storefront IntlPhoneInput deferred (recorded in handoff).
- Production Docker (commit `cadb0dc`): fix compose build contexts to repo root; remove stale package refs from all Dockerfiles; fix `/verify` useSearchParams Suspense prerender. Verified `docker compose config` (staging+prod) and `docker compose build` of api/worker/web/admin images (no deploy). Real secrets/domain/deploy remain human hard stops.
- Storefront IntlPhoneInput + client-side contact validation (commit `8ada4ac`): reusable all-country phone input (default BD +880), mirrored `contact-validation` module, wired into login/register/verify/account/sell. `npm run verify` pass (547 tests / 521 pass / 0 fail / 26 skipped); `npm run web:check` 6/6; storefront e2e 15/15 (added `contact-validation` flow: default BD, India +91 switch, invalid-email block).














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

1. Scheduled notification/contact delivery follow-ups (H/I/J) are captured in `docs/tasks/NOTIFICATION_DELIVERY_BACKLOG.md`: shipment/order-delivery emit, provider-based MFA, staging compose smoke. G (storefront IntlPhoneInput + contact validation UI) is now complete. Dev runs Docker-first (`scripts/dev.mjs` + `infra/docker-compose.yml`) on Node 24 LTS.
2. Bulk CSV import for catalog models/attributes and indicative quote ranges — deferred; larger backend feature (parser + mapping + idempotent batch insert).
3. Install/authenticate a real container scanner (docker scout login or trivy) to produce an actual image vulnerability report.
4. Implement a real bKash HTTP adapter behind the injected gateway contract (sandbox-only until real credentials are approved).
5. Production deployment and real provider credentials remain human-approval hard stops.










## Update rule

Every material merge must update this file when it changes:

- epic/slice status;
- verified test or migration baseline;
- autonomy maturity stage;
- current blocker/hard stop;
- next dependency-ready work;
- main evidence commit after merge (or state that the merge commit must be filled by the next status-only update).

Detailed acceptance evidence belongs in the matching `docs/tasks/` and `docs/handoffs/` files. Historical handoff and task records are preserved under `docs/archive/` to keep the active tree token-light; active working files remain in `docs/tasks/` and `docs/handoffs/`.
