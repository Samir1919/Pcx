# Task: CLINE_AUDIT_FIX_12 — Consolidate admin API clients

- Status: In progress
- Owner/agent: Cline (DeepSeek)
- Branch: `agent/stage3-completion`
- Risk: Low (UI refactor)
- Related epic: `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md`
- Related ADRs: None

## Objective

Remove the duplicated CSRF/fetch/error logic in `catalog-api.js` and
`payment-api.js` by delegating to the shared `apiRequest`/`ApiError` from
`api-client.js`, and reformat both files into multi-line code.

## Source-of-truth references

- `docs/tasks/CLINE_DEEPSEEK_REMAINING_AUDIT_FIXES.md` item #12

## Scope

- `apps/admin/lib/catalog-api.js`, `apps/admin/lib/payment-api.js`: delegate to
  `apiRequest`, re-export `ApiError`/`csrfToken` under legacy aliases.

## Non-scope

- No API/backend changes.

## Domain invariants affected

None.

## Acceptance criteria

- [x] Both files use `apiRequest` instead of hand-rolled `request`.
- [x] Legacy names `CatalogApiError`/`PaymentApiError`/`csrfToken` remain exported.

## State/API/schema/UI impact

UI only.

## Security and privacy review

No behavior change; reduces divergence risk in CSRF handling.

## Test plan

- Unit: `apps/admin/test/catalog-api.test.mjs`, `apps/admin/test/auth-api.test.mjs`.
- Full gate: `npm test`.

## Migration and rollback

None.

## Prohibited changes / hard stops

- None beyond AGENTS.md.
