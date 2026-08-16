# PCX Project Status

- Updated: 2026-08-16
- Current main evidence commit: `8ed08fb`
- Delivery target: tested, documented, GitHub-synced, staging-ready MVP
- Current engineering focus: E8 search/discovery storefront
- Current autonomy maturity: Stage 2 in progress
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
| E6 — Acquisition, cost & final offer | In progress | Server-owned valuation range, final offer lifecycle (ACTIVE→ACCEPTED with expiry), and immutable idempotent acquisition (agreedPrice derived from accepted offer) | Acquisition payment processing, cost allocation, seller accept/reject endpoints |
| E7 — Listing, pricing & passport | In progress | Server-owned listing lifecycle (DRAFT→PUBLISHED), versioned asking-price history, one-active-listing-per-item constraint, and safe public passport projection (`GET /passport/:pcxId`) excluding serial/cost/private evidence | Listing media/QR, reservation/sold transitions, disclosure completeness |
| E8 — Search, discovery & storefront | In progress | Public storefront listing search (`GET /api/v1/listings`) with allow-listed query params, cursor pagination, and safe disclosure-only listing cards (no serial/cost/private evidence) | Storefront UI shell, listing media/QR, recommendation/dedicated search index |
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
| Stage 3 — Multi-agent control plane | Not started | Entry criteria not yet evidenced; no custom orchestration platform justified |
| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |

## Current verification baseline

- Root `npm run verify`: 203 application/unit tests pass; 21 PostgreSQL integration tests skip without `TEST_DATABASE_URL` by design; secret scan + dependency audit pass; Next production build passes.
- CI-equivalent `npm run verify:ci`: 203 application/unit + 21 PostgreSQL integration + 1 E2E smoke, all passing (0 failures).
- E0 artifact verification: 36 required artifacts.
- Dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities.
- Backup/restore drill: seed rows recovered to a throwaway database.
- Latest detailed evidence: `docs/handoffs/E18_BACKUP_STAGING_RELEASE_READINESS.md`.

## Current decisions and hard stops

- ADR 0001 modular monolith: Accepted.
- ADR 0002 PostgreSQL source of truth: Accepted.
- ADR 0003 server-side authentication boundary: Accepted.
- No current implementation blocker.
- Remaining hard stops: production deployment, destructive/irreversible migrations, production/customer-data deletion, real payment destinations/provider credentials, production secrets, test/security weakening, large framework replacement, or core invariant/source-of-truth changes.

## Next dependency-ready work

1. Production deployment (requires explicit human approval — hard stop).
2. Real payment/courier/notification provider credentials (hard stop).
3. Container image scan + sandbox adapters.

## Update rule

Every material merge must update this file when it changes:

- epic/slice status;
- verified test or migration baseline;
- autonomy maturity stage;
- current blocker/hard stop;
- next dependency-ready work;
- main evidence commit after merge (or state that the merge commit must be filled by the next status-only update).

Detailed acceptance evidence belongs in the matching `docs/tasks/` and `docs/handoffs/` files.
