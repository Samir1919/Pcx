# PCX Project Status

- Updated: 2026-08-16
- Current main evidence commit: `a6d5f1f`
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
| E6 — Acquisition, cost & final offer | Pending | Specifications approved | Implementation and financial idempotency |
| E7 — Listing, pricing & passport | Pending | Specifications approved | Implementation and public-leak tests |
| E8 — Search, discovery & storefront | Pending | Specifications approved | Implementation and realistic-volume validation |
| E9 — Cart, reservation & checkout | Pending | Specifications approved | Atomic reservation and double-sell concurrency proof |
| E10 — Order & payment | Pending | Specifications approved | Sandbox adapter, webhook verification/replay and reconciliation |
| E11 — Fulfilment & shipment | Pending | Specifications approved | Courier sandbox adapter and exception recovery |
| E12 — Return & refund | Pending | Specifications approved | Eligibility, serial match and refund idempotency |
| E13 — Warranty & claims | Pending | Specifications approved | Lifecycle and resolution implementation |
| E14 — Admin operations & reporting | Pending | Specifications approved | Operational UI and reports |
| E15 — Notifications | Pending | Specifications approved | Provider-neutral adapters, retries and delivery visibility |
| E16 — Audit, observability & jobs | Pending | Specifications approved | Runtime implementation and runbooks |
| E17 — Security hardening | Pending | Threat model approved; early controls implemented incrementally | Full regression/scanning/headers/upload/MFA gates |
| E18 — Backup, staging & release readiness | Pending | Infrastructure plan approved | Staging, restore drill, rehearsal, smoke/rollback/launch gates |

## Agentic maturity

| Stage | Status | Evidence / trigger |
|---|---|---|
| Stage 1 — Lean controlled development | Complete | Project Brain, hard stops, bounded branches/tasks, tests, review, handoffs and safe merge flow |
| Stage 2 — MVP integration/release discipline | In progress | Locked install, additive migrations, migration checksums, integration tests, CI PostgreSQL service, secret/dependency scanning, staging overlay, E2E smoke path, database backup/restore drill; container image scan and sandbox payment/courier/notification adapters remain |
| Stage 3 — Multi-agent control plane | Not started | Entry criteria not yet evidenced; no custom orchestration platform justified |
| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |

## Current verification baseline

- Root `npm run verify`: 127 application/unit tests pass; secret scan + dependency audit pass; Next production build passes.
- CI-equivalent `npm run verify:ci`: 127 application/unit + 12 PostgreSQL integration + 1 E2E smoke, all passing (0 failures).
- E0 artifact verification: 36 required artifacts.
- Dependency audit (`npm audit --omit=dev --audit-level=high`): 0 known vulnerabilities.
- Backup/restore drill: seed rows recovered to a throwaway database.
- Latest detailed evidence: `docs/handoffs/E5_INSPECTION_TEMPLATES.md`.

## Current decisions and hard stops

- ADR 0001 modular monolith: Accepted.
- ADR 0002 PostgreSQL source of truth: Accepted.
- ADR 0003 server-side authentication boundary: Accepted.
- No current implementation blocker.
- Remaining hard stops: production deployment, destructive/irreversible migrations, production/customer-data deletion, real payment destinations/provider credentials, production secrets, test/security weakening, large framework replacement, or core invariant/source-of-truth changes.

## Next dependency-ready work

1. E8 search/discovery storefront integration on top of the completed public catalog.
2. E5 inspection execution/results and E4 inventory lifecycle transitions.
3. E3 admin sell-request queue/detail and valuation/offer flows.

## Update rule

Every material merge must update this file when it changes:

- epic/slice status;
- verified test or migration baseline;
- autonomy maturity stage;
- current blocker/hard stop;
- next dependency-ready work;
- main evidence commit after merge (or state that the merge commit must be filled by the next status-only update).

Detailed acceptance evidence belongs in the matching `docs/tasks/` and `docs/handoffs/` files.
