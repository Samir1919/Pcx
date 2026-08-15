# PCX Project Status

- Updated: 2026-08-16
- Current main evidence commit: `d5e89df`
- Delivery target: tested, documented, GitHub-synced, staging-ready MVP
- Current engineering focus: E2 ProductModel specification-value assignment UI
- Current autonomy maturity: Stage 2 in progress
- Production deployment: not authorized

This file is the central progress index. Approved specifications define what PCX must become; task files, handoffs, tests, migrations, and Git commits prove what is complete. Percentages are intentionally omitted because they are not reliable acceptance evidence.

## Epic status

| Epic | Status | Verified scope | Remaining critical scope |
|---|---|---|---|
| E0 — Repository & engineering foundation | Complete | Monorepo boundaries, Project Brain, portable agent rules, CI skeleton, local service definitions, verification commands | Controls continue evolving under Stage 2 |
| E1 — Identity, authentication & RBAC | In progress | Identity/RBAC contracts; auth/session and secure browser flows; audit/runtime/local limiter; contact/reset flows; privileged MFA gate; authenticated `/me`; ownership-safe authenticated address CRUD with origin/CSRF | MFA verification/enrollment/provider; production delivery/distributed limits/atomic audit; admin user/role screens |
| E2 — Catalog & Product Model | In progress | Category/Brand/ProductModel contracts; typed specs; safe public API; PostgreSQL persistence/runtime; audited admin catalog and typed specification-definition/value commands; responsive authorized catalog UI foundation; launch seeds and volume validation | Category-aware model specification-value assignment/editing UI |
| E3 — Sell-to-PCX | Pending | Specifications approved | Implementation and tests |
| E4 — Physical intake & inventory identity | Pending | Specifications approved | Implementation and duplicate-identity tests |
| E5 — Inspection & verification | Pending | Specifications approved | Implementation and integrity tests |
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
| Stage 2 — MVP integration/release discipline | In progress | Locked install, PostgreSQL additive migrations, migration ledger/checksums, integration tests, CI PostgreSQL service; staging/security scans/E2E/restore gates remain |
| Stage 3 — Multi-agent control plane | Not started | Entry criteria not yet evidenced; no custom orchestration platform justified |
| Stage 4 — Production delivery/operations | Not started | Requires real staging/production operations and explicit production approval |

## Current verification baseline

- Root `npm run verify`: 80 unit/application tests pass; 9 PostgreSQL tests skip without `TEST_DATABASE_URL` by design; admin production build passes.
- CI-equivalent `npm run verify:ci`: 89/89 tests pass with PostgreSQL; integration suite 9/9 passes.
- E0 artifact verification: 36 required artifacts.
- Locked dependency audit at persistence merge: 0 known vulnerabilities.
- Latest detailed evidence: `docs/handoffs/E2_ADMIN_CATALOG_UI.md`.

## Current decisions and hard stops

- ADR 0001 modular monolith: Accepted.
- ADR 0002 PostgreSQL source of truth: Accepted.
- ADR 0003 server-side authentication boundary: Accepted.
- No current implementation blocker.
- Remaining hard stops: production deployment, destructive/irreversible migrations, production/customer-data deletion, real payment destinations/provider credentials, production secrets, test/security weakening, large framework replacement, or core invariant/source-of-truth changes.

## Next dependency-ready work

1. E2 category-aware ProductModel specification-value assignment/editing UI.
2. E1 provider-neutral MFA verification/enrollment contract before privileged staging access.
3. E3 Sell-to-PCX request intake foundation after remaining E1/E2 gates.

## Update rule

Every material merge must update this file when it changes:

- epic/slice status;
- verified test or migration baseline;
- autonomy maturity stage;
- current blocker/hard stop;
- next dependency-ready work;
- main evidence commit after merge (or state that the merge commit must be filled by the next status-only update).

Detailed acceptance evidence belongs in the matching `docs/tasks/` and `docs/handoffs/` files.
