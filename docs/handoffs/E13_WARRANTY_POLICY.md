# Agent Handoff: E13 warranty policy authoring

- Status: Complete
- Branch: main
- Latest commit: 12530e9
- Date: 2026-09-01

## Outcome

Admins can author reusable warranty policies (name, duration, coverage, terms),
list them, and archive (never delete) them. A policy snapshot helper is exposed
so warranties can later reference an authored policy instead of the manual `{}`
snapshot.

## Changed areas

- `packages/domain/src/warranty/warranty-claim.mjs` — `WarrantyPolicyStatus`,
  `createWarrantyPolicy`, `archiveWarrantyPolicy`, `toWarrantyPolicySnapshot`.
- `packages/domain/src/index.mjs` — exports.
- `apps/api/migrations/0041_warranty_policies.sql` — `warranty_policies` table.
- `apps/api/src/modules/warranty/postgres-warranty-policy-repository.mjs`,
  `warranty-policy-service.mjs`, `warranty-policy-http.mjs` (new) — CRUD +
  archive, SYSTEM_CONFIGURE-gated.
- `apps/api/src/modules/identity/auth-runtime.mjs`, `server.mjs` — wiring.
- `apps/admin/lib/warranty-api.js`, `apps/admin/app/(workspace)/warranty/page.js`
  — policy authoring panel (list + form + archive).
- Tests: domain, service, migrations list.

## Acceptance criteria

- [x] Warranty policy authoring (create/list/archive), server-owned.
- [x] Snapshot helper to replace the manual `policySnapshot: {}`.

## Verification

| Command/test | Result |
|---|---|
| `node --test packages/domain/test/warranty-claim.test.mjs` | pass |
| `node --test apps/api/test/warranty-policy-service.test.mjs` | pass |
| `node --test apps/api/test/integration/migrations.test.mjs` | pass (DB) |
| `npm test` (unit) | 0 fail |
| `PCX_HEADED=1 node scripts/admin-e2e-check.mjs --evidence` | 30/30 pass |
| `npm run lint` / `typecheck` / `ui-guard` | pass |

Note: two integration tests (`sell-request-repository`, `sell-taxonomy-repository`)
fail against the shared local `pcx` DB from prior-run pollution — pre-existing.
`npm run build` fails locally under Node v26.4.0 — pre-existing.

## Architecture/security review

- Policy authoring + archive gated by SYSTEM_CONFIGURE; archive is append-only
  (never deletes), so issued warranties' coverage facts are preserved.

## Schema/configuration/deployment

- Migration `0041_warranty_policies.sql` (additive).

## Remaining work and next safe action

- Wire `createWarranty` to reference an authored policy (snapshot + duration).
- Claim inspections, carrier pickup, cost accounting.
- E14/E16 reporting & audit (BI/SIEM).

## Blockers requiring human decision

- None.
