---
source: https://docs.google.com/document/d/1zSfB28uabx9nUkIBUKt9RMTTrVq9r6wegRu0bRG5VqA/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — INFRASTRUCTURE, DEVOPS & DEPLOYMENT ARCHITECTURE v1.0
Verified Used Tech Recommerce Platform — Bangladesh

## 1. ARCHITECTURE STRATEGY
Start as a modular monolith with clear domain modules, not premature microservices. Separate web/customer UI, admin/technician UI concerns, API application, background workers and data infrastructure. Boundaries must allow future extraction without distributed-system overhead on day one.

## 2. LOGICAL COMPONENTS
Customer Web/PWA
Admin/Technician Web
API Application
Worker/Scheduler
PostgreSQL primary database
Redis for cache, rate-limit primitives, short-lived coordination/queues where chosen
Object Storage for listing images/private evidence
Search: PostgreSQL search initially; dedicated engine only when measured need justifies it
Email/SMS notification adapters
Payment adapter
Courier adapter
Observability stack

## 3. DOMAIN MODULES
identity, catalog, acquisition/sell-to-pcx, inventory, inspection, pricing/listing, cart/reservation, order, payment/refund, logistics, return, warranty, notification, audit/reporting. Modules own business rules and expose application services; cross-module direct table manipulation is prohibited in application design.

## 4. ENVIRONMENTS
Local: developer machine + containers/services.
CI: ephemeral test environment.
Staging: production-like integrations in sandbox/test mode.
Production: isolated credentials/data/storage.
Environment configuration is explicit; no production secret/data in local or staging.

## 5. REPOSITORY STRATEGY
Recommended monorepo:
/apps/web — customer PWA
/apps/admin — admin + technician responsive interface
/apps/api — backend HTTP API
/apps/worker — jobs/events
/packages/domain — shared domain contracts where appropriate
/packages/ui — shared design system
/packages/config — lint/typescript/build config
/packages/testing — test helpers
/infra — container/deployment/IaC definitions
/docs — Project Brain/ADRs/spec references
Exact framework choices can be locked in implementation ADR, but domain boundaries remain stable.

## 6. DATABASE
PostgreSQL as transactional source of truth. Migrations are version-controlled and forward-reviewed. Production schema changes run through CI/CD with backups/rollback strategy. Use constraints for uniqueness/integrity, not application checks alone. Connection pooling configured. Read replicas/search infrastructure are later scale options, not MVP requirements.

## 7. REDIS / QUEUE
Use for ephemeral cache, rate limiting and job coordination; never the sole durable record for order/payment/inventory truth. Jobs have retry policy, dead-letter/failure visibility and idempotent handlers. Critical domain-event publication uses transactional outbox or equivalent.

## 8. OBJECT STORAGE
Separate public listing assets from private inspection/warranty/seller evidence. Use generated keys, lifecycle rules, signed access for private files, CDN for public assets. Database stores metadata/references, not large binary blobs.

## 9. EDGE & INGRESS
DNS → CDN/WAF where used → TLS reverse proxy/load balancer → application. Only required HTTP(S) ingress is public. Database/Redis/internal management ports remain private. Health endpoints distinguish liveness/readiness.

## 10. CI PIPELINE
On pull request: install locked dependencies; lint; typecheck; unit tests; migration/schema checks; integration tests; build; secret scan; dependency vulnerability scan; container scan when container image exists. Protected branch requires passing gates before merge.

## 11. CD PIPELINE
Merge/release → immutable build artifact/image → deploy staging → migrations under controlled step → smoke tests → production promotion → post-deploy health checks. Failed health/smoke gate stops rollout. Application rollback is prepared; destructive DB migration requires explicit compatibility plan.

## 12. ZERO/LOW-DOWNTIME DATABASE CHANGE RULE
Prefer expand-and-contract: add compatible column/table/index; deploy code supporting both; backfill asynchronously if needed; switch reads/writes; remove obsolete schema in later release. Never combine irreversible destructive migration with dependent code in a way that prevents rollback.

## 13. BACKGROUND JOBS
Reservation expiry; payment reconciliation; courier sync; notification delivery; image processing; search indexing; report aggregation; warranty SLA; stale sell request/offer expiry. Jobs record attempts/errors and expose operational queue visibility.

## 14. OBSERVABILITY
Structured centralized logs with request/correlation IDs. Metrics for HTTP, DB pool, worker queue, job failures, payment errors, checkout conflicts, reservation expiry, inspection throughput, order funnel. Error tracking captures stack traces server-side without leaking them to users. Alerts target actionable failures, not noise.

## 15. BACKUP & DISASTER RECOVERY
Automated PostgreSQL backups + point-in-time capability where provider supports; object-storage versioning/backup policy for critical evidence; configuration/IaC in source control; encrypted backup copy outside primary failure domain. Define RPO/RTO before launch and perform restore drills.

## 16. DEPLOYMENT OPTIONS
MVP can run on a reputable managed cloud/VPS architecture with managed PostgreSQL/object storage where budget permits. Avoid Kubernetes at initial scale unless operational requirements genuinely justify it. Docker/containerized deployment is useful for repeatability but orchestration complexity should match team size.

## 17. SCALING PATH
Stage 1: single API service + worker + managed DB/Redis/storage.
Stage 2: horizontal API replicas behind load balancer; separate worker pools; CDN/image optimization.
Stage 3: search service, read scaling, specialized queues.
Stage 4: extract high-pressure bounded contexts only when metrics/team boundaries justify microservices.

## 18. PERFORMANCE TARGETS
Set measurable SLOs before launch: API p95 latency by endpoint class, availability target, checkout/payment reliability, job delay, image performance. Optimize from production/staging measurements; cache only where consistency rules are understood.

## 19. RELEASE STRATEGY
Feature flags for risky/post-MVP capabilities. Staged rollout for payment, trade-in and automated pricing. Every release has version, changelog, migration status and rollback notes. Production hotfix follows same auditable pipeline with expedited review, not direct server edits.

## 20. INFRASTRUCTURE SECURITY
Least-privilege service accounts; private DB/cache; MFA for cloud/CI admin; secret manager; restricted production SSH/console; patching; firewall/security groups; encrypted transport/storage; audit logs; dependency/image scans. No shared root credentials.

## 21. DEVELOPMENT WORKSTATIONS
Standardized runtime versions, package manager lockfile, pre-commit/pre-push quality checks where useful, .env.example without secrets, local seed fixtures with synthetic data. One command should bootstrap development as closely as practical.

## 22. TEST DATA
Factories/fixtures create customers, sellers, models, inventory, inspections, listings, orders and claims. Never depend on production database copies for ordinary development. Staging payment/courier integrations use sandbox/test credentials.

## 23. OPERATIONAL RUNBOOKS
Minimum runbooks: deploy/rollback, failed migration, DB restore, payment mismatch, stuck reservation, queue backlog, courier outage, object-storage failure, secret rotation, suspected account compromise, incident response.

## 24. MVP CAPACITY PRINCIPLE
Design correctness before speculative scale. PostgreSQL transactions and strong domain boundaries can support substantial early commerce volume. Add distributed complexity only when observed bottlenecks or organizational needs justify it.

## 25. DEVOPS EXIT CRITERIA
Reproducible local setup; CI mandatory; staging exists; production isolated; migrations controlled; backups automated and restore-tested; logs/metrics/error tracking working; health checks and alerts working; rollback tested; secrets externalized; runbooks available.

FINAL PRINCIPLE
PCX infrastructure must make safe deployment boring: repeatable builds, controlled state changes, observable failures, recoverable data and the minimum architecture complexity needed for the current scale.
