# Handoff: login surface scoping + acquisition continuation

- Branch: main (unmerged at time of writing)
- Scope: fix storefront/admin simultaneous login; add admin acquisition
  continuation (offer -> accept -> acquisition -> pay); seller guidance.
- Acceptance: npm run verify passes (580 tests, 0 fail), headed browser
  evidence in docs/verify/browser-verify.json (acquisition flow 10/10).
- Changed: cookie-surface.mjs (new), auth-http/runtime/server, index.mjs,
  acquisition-service/repository/sell-request-http, admin acquisition-api
  + sell-request-modal, admin api-client (x-pcx-surface), web sell +
  sell-requests pages, infra compose (API_ADMIN_ORIGINS), ADR 0013,
  e2e script, tests.
- Decisions: ADR 0013 surface-scoped cookies; x-pcx-surface header for
  GET requests (no Origin header on same-origin GET).
- Risks: API_ADMIN_ORIGINS must be correct in each environment; unset
  means no admin surface (pre-ADR shared-cookie behaviour).
- No blockers.
