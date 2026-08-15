---
source: https://docs.google.com/document/d/18---XSSZSUlxlwDtYmaUijBjKVVnni2V7pWFb5_BxjE/edit
status: approved
version: 1.0
synced: 2026-08-16
---

# PCX — PROJECT BRAIN & AUTONOMOUS AGENTIC DEVELOPMENT SYSTEM v1.0
Implementation Operating System

## 1. PURPOSE
This is the persistent engineering brain for PCX. AI agents do not invent architecture per task; they read approved specifications, ADRs, domain rules and acceptance gates, then execute bounded work. Goal: high autonomy with low human interaction while preventing uncontrolled architectural drift or dangerous production actions.

## 2. SOURCE-OF-TRUTH HIERARCHY
1) Approved business/product requirements
2) Detailed user flow & screen map
3) Database ERD/schema rules
4) API specification & state machines
5) Security architecture
6) Infrastructure/DevOps architecture
7) ADRs
8) Coding standards/module contracts
9) Task-specific specification
If sources conflict, higher-priority approved source wins and agent must flag the conflict rather than silently choose.

## 3. PROJECT BRAIN REPOSITORY
/docs/brain/README.md — how agents use the brain
/docs/brain/product.md — vision, actors, MVP boundaries
/docs/brain/domain-rules.md — invariant business rules
/docs/brain/state-machines.md
/docs/brain/security.md
/docs/brain/architecture.md
/docs/brain/database.md
/docs/brain/api.md
/docs/brain/ui-ux.md
/docs/brain/testing.md
/docs/brain/devops.md
/docs/adr/ — architecture decision records
/AGENTS.md — mandatory agent instructions
Each document is concise enough for retrieval but links to full approved specifications.

## 4. NON-NEGOTIABLE DOMAIN INVARIANTS
A physical used item has one unique lifecycle identity.
ProductModel and InventoryItem are separate.
An item cannot be sold twice.
Client cannot authoritatively set price/totals/role/status/grade/warranty eligibility.
Submitted inspection history is preserved.
Critical inspection override is privileged, reasoned and audited.
Estimated seller range is not final offer.
Trade-in acquisition and new sale are separate accounting records.
Order snapshots preserve sold facts.
Payment/refund/acquisition financial operations are idempotent.
Public passport never leaks full serial/acquisition/internal evidence.
State transitions are server enforced.

## 5. AGENT ROLES
Orchestrator — owns task DAG, dependency ordering, budget/timeouts, retries and completion report.
Spec Agent — converts feature request into explicit requirements/acceptance criteria and identifies affected source-of-truth rules.
Planner/Architect — maps files/modules/schema/API impacts; creates implementation plan; no speculative redesign.
Worker Agent — implements one bounded task, tests it, records changes.
Reviewer Agent — independent review for correctness, architecture, security and maintainability; does not rubber-stamp worker output.
QA Agent — runs unit/integration/e2e/concurrency/security regression relevant to task.
Security Agent — reviews auth, authorization, uploads, payments, PII, secrets and dependency changes when affected.
DevOps Agent — build/container/migration/deployment validation; cannot production-deploy without gate.
Reporter — summarizes completed work, tests, risks, migrations and unresolved issues.

## 6. TASK DAG MODEL
Feature request → specification → dependency analysis → tasks sized to one coherent change → implementation → local tests → review → fixes → integration tests → security checks → build → staging-ready package → report.
Tasks declare inputs, files/modules, dependencies, acceptance criteria, prohibited changes and expected tests.

## 7. AUTONOMY LEVELS
L0 Observe: analyze/report only.
L1 Suggest: propose patch/plan.
L2 Implement in branch/worktree; no external side effects.
L3 Implement + test + commit automatically.
L4 Multi-task autonomous run + PR creation after gates.
L5 Staging deployment after automated gates where explicitly configured.
Production deployment, destructive migration, credential/permission change and irreversible financial/data action remain human approval gates unless governance is deliberately changed later.

## 8. HARD STOPS
Production deployment.
Destructive/irreversible database migration.
Deleting production/customer data.
Changing payment destination/provider credentials.
Changing authentication/security policy with material risk.
Rotating production secrets.
Disabling tests/security controls.
Large dependency/framework replacement.
Changing core domain invariant/source-of-truth without approved ADR.
Agent stops and requests approval with impact summary.

## 9. SPEC AGENT OUTPUT
Problem; user/actor; current behavior; desired behavior; scope; non-scope; affected flows; affected domain invariants; acceptance criteria; edge cases; state transitions; API/schema/UI impacts; security/privacy implications; test scenarios; rollout/migration needs.
No implementation starts until spec is internally consistent.

## 10. PLANNER OUTPUT
Task DAG with IDs; dependency graph; target modules/files; DB migration plan; API changes; UI changes; test plan; rollback/compatibility notes; risk classification. Planner should prefer existing patterns over new abstractions.

## 11. WORKER LOOP
Read task + relevant brain docs → inspect existing code/tests → implement smallest coherent change → format/lint/typecheck → targeted tests → fix failures → self-review diff → commit with task ID. Worker may retry bounded failures but must escalate repeated/ambiguous failures rather than looping indefinitely.

## 12. REVIEWER CHECKLIST
Requirement coverage; invariant preservation; state transition correctness; authorization/ownership; transaction/concurrency; idempotency; data migration safety; error/recovery path; sensitive-data exposure; test adequacy; unnecessary complexity; backwards compatibility; observability/audit.
Reviewer outputs BLOCKER/MAJOR/MINOR/NIT. BLOCKER/MAJOR must be resolved or explicitly waived.

## 13. QA STRATEGY
Unit tests for domain rules/state transitions.
Integration tests for DB/API transactions.
E2E for critical customer/admin/technician journeys.
Concurrency test for unique inventory purchase.
Webhook replay/idempotency tests.
Authorization matrix/IDOR tests.
Migration tests.
Regression suite on merge/release.
UI tests focus on business-critical flows rather than brittle cosmetic selectors.

## 14. AGENT MEMORY RULE
Agents may use repository docs and current task artifacts as durable memory. Conversational assumptions are not source of truth until written into approved Project Brain/ADR/spec. Important new decisions discovered during work must be proposed as documentation changes.

## 15. CONTEXT RETRIEVAL
Before coding, agent retrieves only relevant brain sections plus affected code to reduce context noise. Always include domain invariants, affected state machine and security rules for critical modules. Never rely solely on embedding retrieval for non-negotiable invariants; AGENTS.md carries a compact mandatory set.

## 16. BRANCH/WORKTREE STRATEGY
One feature/epic run uses isolated branch. Parallel workers use separate worktrees/branches for non-overlapping tasks. Orchestrator prevents two agents editing the same migration/module simultaneously unless coordinated. Integration occurs after task tests and review.

## 17. COMMIT STANDARD
Small coherent commits; task ID + intent; no generated noise/secrets; migration and dependent code clearly related. Agents cannot rewrite shared published history. Final PR description includes feature summary, architecture/schema/API changes, tests, screenshots where UI, migration/rollback and risks.

## 18. RETRY & FAILURE POLICY
Classify failures: deterministic code/test, flaky external, missing requirement, architecture conflict, permission/tool failure. Retry deterministic fix loops with bounded count. Flaky test is investigated, not blindly rerun forever. Requirement/architecture ambiguity escalates. Tool permission failure is reported; agents do not bypass controls.

## 19. BUDGET & TIME CONTROL
Orchestrator assigns max attempts and task scope. Large feature is decomposed before execution. Agent must not spend unlimited cycles optimizing non-blocking issues. Completion report distinguishes done, deferred and blocked.

## 20. MIGRATION GOVERNANCE
Every migration has forward change, compatibility analysis, data backfill plan if required, rollback/mitigation, test and expected lock/performance impact. Destructive migration is a hard stop. Agents use expand-contract pattern.

## 21. SECURITY GOVERNANCE
Security Agent is mandatory for auth/RBAC, payment/refund, upload/evidence, PII, public passport, admin privileges, secrets, external callbacks. Secret scanning and dependency scan are automated. Agent never puts credentials in prompt output, logs, fixtures or commits.

## 22. UI GOVERNANCE
Screens implement approved flow/state, including loading/empty/error/conflict/recovery. Customer UX remains simple; operational traceability remains deep. Design-system components are reused. Agent cannot hide unavailable backend behavior with fake UI success.

## 23. DEFINITION OF DONE — TASK
Code implemented; lint/typecheck pass; targeted tests pass; relevant docs updated; reviewer blockers resolved; no secret/sensitive leakage; migration validated if any; audit/observability added for critical state changes; commit produced.

## 24. DEFINITION OF DONE — FEATURE
All task DAG nodes complete; integration/e2e pass; security review pass where applicable; build succeeds; migration plan validated; staging smoke test ready/pass when environment available; PR/report contains risks and rollback; acceptance criteria traceability complete.

## 25. NIGHT-RUN / LOW-HUMAN-INTERACTION MODE
User gives an approved feature/epic. Orchestrator performs spec check, plans DAG, runs independent safe tasks, reviews, fixes, tests, commits and prepares PR/report. It stops only at hard gate, unresolved ambiguity affecting business truth, unavailable required credential/service, repeated failing gate, or budget/time ceiling. Morning report shows exactly what changed and what needs a decision.

## 26. MORNING REPORT FORMAT
Executive status: COMPLETE/PARTIAL/BLOCKED.
Completed tasks and commits.
Acceptance criteria status.
Tests and results.
Schema/migration changes.
Security findings.
Screenshots/UI notes.
Known risks/technical debt.
Blocked decisions requiring human input.
Recommended next action.

27. INITIAL AGENTS.md CONTRACT
Read /docs/brain before material changes. Preserve PCX invariants. Never bypass state machines/RBAC. Never trust client commerce values. Never expose restricted fields. Never make destructive migration or production deploy without approval. Write tests for changed business behavior. Run required gates before commit. Update docs when approved behavior changes. Report ambiguity rather than inventing business policy.

## 28. ADR PROCESS
Use ADR when selecting/changing framework, database pattern, auth model, queue/event architecture, storage strategy, search engine, payment integration pattern or core domain design. ADR includes context, decision, alternatives, consequences, migration impact and status. Superseded ADR remains in history.

## 29. FIRST IMPLEMENTATION EPICS
E0 Repository/tooling + Project Brain.
E1 Identity/RBAC foundation.
E2 Catalog/ProductModel.
E3 Sell-to-PCX request/intake.
E4 Inventory + unique identifiers.
E5 Inspection templates/results/health/grade.
E6 Listing/pricing/passport.
E7 Customer search/product detail/cart.
E8 Reservation/checkout/order.
E9 Payment/refund integration.
E10 Fulfilment/shipment.
E11 Return/warranty.
E12 Admin operations/reporting/audit.
E13 Security hardening/observability/backup/release.
Trade-in/open marketplace remain post-MVP unless reprioritized.

## 30. IMPLEMENTATION ORDER RULE
Build vertical slices around business truth rather than all database then all API then all UI. Foundation first, then acquisition→inspection→listing, then buyer purchase→fulfilment→after-sales. Each epic should leave tested usable behavior.

FINAL PRINCIPLE
Autonomy comes from constraints, not from giving an agent unlimited freedom. PCX agents can work for hours without supervision because architecture, invariants, tests, permissions, state machines and hard stops make the safe path explicit.
