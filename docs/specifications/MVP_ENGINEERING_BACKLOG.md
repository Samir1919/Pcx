---
source: https://docs.google.com/document/d/125cMgTuYt7fx_jKtOBj02MWWttLXIZMjGMby2Di-3_o/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — MVP ENGINEERING BACKLOG & IMPLEMENTATION PLAN v1.0
Agent-Executable Build Sequence

## 1. GOAL
Convert PCX specifications into implementation epics and acceptance gates. This is sequencing guidance; each epic is decomposed by the Planner Agent into small task DAG nodes before coding.

E0 — REPOSITORY & ENGINEERING FOUNDATION
Deliver: monorepo/apps/packages structure; package/runtime lock; lint/format/typecheck; environment config; local DB/Redis/storage adapters; migration framework; test framework; CI skeleton; AGENTS.md; /docs/brain; ADR template; health endpoints.
Acceptance: clean clone boots from documented command; CI build/test passes; no secrets committed.

E1 — IDENTITY, AUTHENTICATION & RBAC
Deliver: User, Address, Role/Permission; register/login/logout/session/refresh model; verified contact; password reset; privileged MFA integration point; admin user/role screens; authorization middleware/policies; audit auth/role changes.
Tests: login abuse/rate limit, ownership, role matrix, privilege escalation.

E2 — CATALOG & PRODUCT MODEL
Deliver: categories, brands, product models, attributes/specs, search aliases; admin CRUD/archive; public category/model read; seed data; category-specific attribute validation.
Rule: no physical serial/cost/health data in ProductModel.

E3 — SELL-TO-PCX REQUEST
Deliver: seller flow S01-S12; draft/submission; declarations; photos; estimated-range placeholder/rule engine interface; admin queue/detail; info request/reject/inspection request; seller status timeline/notifications.
Tests: ownership of request, invalid state edits, upload controls.

E4 — PHYSICAL INTAKE & INVENTORY IDENTITY
Deliver: intake record; link ProductModel; serial/identifier normalization; duplicate detection; intake media; acquisition linkage; InventoryItem lifecycle; PCX ID generation; admin inventory queue/detail.
Critical test: duplicate identifier blocked; lifecycle history preserved.

E5 — INSPECTION & VERIFICATION
Deliver: versioned inspection templates; technician queue; test result entry; evidence; autosave/draft; submit; health score engine interface; grade rules; approve/reject/escalate; supervisor retest/override; audit.
Tests: mandatory test enforcement, immutable submitted result, critical fail override controls.

E6 — ACQUISITION, COST & FINAL OFFER
Deliver: valuation; final offer; seller accept/reject; acquisition record; acquisition payment state; ownership confirmation; direct/refurbishment costs; finance permissions.
Rule: estimated range ≠ final offer; payment idempotent.

E7 — LISTING, PRICING & DIGITAL PASSPORT
Deliver: pricing workspace; price history; warranty configuration; listing publish/unpublish; actual item photos; public product detail data; passport DTO with masked serial; QR-ready stable passport URL.
Tests: rejected/unapproved item cannot publish; public sensitive fields absent.

E8 — SEARCH, DISCOVERY & CUSTOMER STOREFRONT
Deliver: home; search/autocomplete; category listing; filters/sort; product cards; product detail; passport; availability state; responsive PWA baseline; trust explainer.
Performance: indexes/query plan validated against realistic seed volume.

E9 — CART, RESERVATION & CHECKOUT
Deliver: cart; buy now; checkout contact/address/delivery/payment selection; atomic reservation; expiry worker; order review; authoritative totals.
Critical concurrency test: simultaneous checkout of same physical item produces exactly one winning allocation.

E10 — ORDER & PAYMENT
Deliver: order snapshot; payment intent/provider adapter; verified webhook; payment reconciliation; COD policy adapter if enabled; confirmation; customer order history/detail; admin order queue.
Tests: webhook replay, browser fake success, payment-after-expiry reconciliation, duplicate order idempotency.

E11 — FULFILMENT & SHIPMENT
Deliver: processing/packing; packaging evidence; shipment/courier adapter; tracking; delivery state; notifications; exception states and admin recovery.

E12 — RETURN & REFUND
Deliver: customer return request; eligibility; evidence; receive/serial match; assessment; refund/replacement/repair resolution; refund idempotency; timelines/audit.

E13 — WARRANTY & CLAIMS
Deliver: warranty snapshot/activation; customer claim; eligibility; receive/diagnosis; repair/replace/refund/reject; SLA/status notification; claim audit.

E14 — ADMIN OPERATIONS & REPORTING
Deliver: dashboard queues/KPIs; universal search by PCX ID/serial/order/contact; customer view; inventory ageing; inspection queue metrics; payment exceptions; returns/warranty queues; basic sales/margin reporting; export permissions.

E15 — NOTIFICATION SYSTEM
Deliver: event-driven email/SMS adapters; templates; delivery attempts; retry/failure; deep links; user notification center where included. No business transaction depends on notification provider success.

E16 — AUDIT, OBSERVABILITY & JOB OPERATIONS
Deliver: audit viewer; structured logs; correlation IDs; metrics; error tracking; job dashboard/failure visibility; alerts; outbox processing; operational runbooks.

E17 — SECURITY HARDENING
Deliver: security headers/CSP; CSRF/CORS; upload hardening/scanning integration; secret management; privileged MFA; rate limits; dependency/secret scans; IDOR suite; public data-leak suite; payment/security regression.

E18 — BACKUP, STAGING & RELEASE READINESS
Deliver: staging; production config separation; DB/object backup; restore drill; migration rehearsal; smoke tests; rollback; SLO dashboards; incident/runbook check; launch checklist.

MVP RELEASE GATE
Customer can discover a real unique item, inspect its PCX verification passport, reserve/pay/order it without double sale, track delivery, and request return/warranty. PCX can acquire an item from a seller, physically identify/inspect/grade it, pay acquisition, price/list it, fulfil sale and preserve audit/financial history. Critical security, backup and observability gates pass.

POST-MVP EPICS
Trade-in optimization; saved search/stock alerts; open marketplace sellers/KYC/commission/payout; dealer portal; PC builder/compatibility; price intelligence; AI advisor; PCX Certified partners; native mobile app; advanced fraud/risk automation.

AGENT EXECUTION RULE
Do not run all epics as one giant coding prompt. Orchestrator selects the next dependency-ready epic, Spec Agent confirms acceptance criteria, Planner decomposes it, Workers execute bounded tasks, Reviewer/QA gate it, then the epic is integrated. This supports unattended multi-hour work without losing traceability.

FINAL BUILD ORDER
Foundation → Identity → Catalog → Sell Request → Intake/Inventory → Inspection → Acquisition → Listing/Passport → Storefront → Reservation/Checkout → Payment/Order → Fulfilment → Return → Warranty → Admin/Reporting → Notifications/Observability/Security → Release.
