# Agent Handoff: RBAC + Merchant + User Management

- Status: Complete (feature slices), uncommitted on `main`
- Branch: `main` (working tree has changes; not yet committed)
- Date: 2026-08-19

## Scope (user-approved)

- Backend role/permission system with MERCHANT role, admin access gate,
  identity management API, and merchant listing CRUD (path A: proposed price,
  PCX-approved final price).
- Admin: `admin:access` gate + "Users" management page + sidebar nav.
- Web storefront: login + register pages, navbar auth state, merchant dashboard.
- Default signup role stays `CUSTOMER`. "visitor" concept dropped.

## Decisions

- Price policy = **Path A**: merchants submit a `proposed_price` (indicative);
  PCX records the final sellable price in `listing_prices` at approval. The core
  invariant "client input never authoritatively sets price" is preserved.
- `ADMIN` and `SUPER_ADMIN` both gain `role:assign` (previously only
  `SUPER_ADMIN`). ADMIN can assign MERCHANT/etc. but never SUPER_ADMIN; self
  elevation blocked (existing `authorizeRoleAssignment` guard retained).

## Changed / added files

### Domain (`packages/domain`)
- `src/identity/constants.mjs`: `Role.MERCHANT`; new permissions
  `admin:access`, `identity:read`, `identity:manage`,
  `merchant-listing:read:self`, `merchant-listing:manage:self`.
- `src/identity/role-policy.mjs`: MERCHANT + staff `admin:access`; ADMIN gains
  `admin:access`, `identity:read`, `identity:manage`, `role:assign`.
- `src/identity/index.mjs` (new): browser-safe identity re-export.
- `test/identity-role-policy.test.mjs`: extended matrix + escalation guards.

### Backend (`apps/api`)
- Migration `migrations/0027_identity_merchant_and_admin_access.sql`: MERCHANT
  role, 5 permissions, role->permission grants, listings `owner_user_id`,
  nullable `inventory_item_id`, `product_model_id`, `proposed_price`,
  `updated_at`, indexes.
- `src/modules/identity/user-admin-{repository,service,http}.mjs` (new):
  `GET /api/v1/admin/users`, `PATCH .../users/:id/status`,
  `PUT .../users/:id/roles`. Permission-gated, self-change + super-admin guards,
  audit persisted to `auth_audit_events`.
- `src/modules/listing/merchant-listing-{repository,service,http}.mjs` (new):
  `GET/POST /api/v1/merchant/listings`, `PATCH/DELETE .../listings/:id`.
  Owner-scoped, DRAFT-only edit/archive.
- `src/modules/identity/auth-runtime.mjs`: wire userAdminService +
  merchantListingService.
- `src/server.mjs`: wire both new handlers.

### Admin (`apps/admin`)
- `lib/users-api.js` (new), `lib/access.js` (new frontend policy mirror).
- `app/(workspace)/users/{page,workspace}.js` (new): list/filter + status/role
  controls.
- `app/user-shell.js`: `admin:access` gate via `access.js`; "Users" nav item.
- `app/login/page.js`: demo credentials only in development (earlier fix).
- `app/(workspace)/catalog/workspace.js`: "New category" typo fix (earlier).

### Web (`apps/web`)
- `lib/access.js` (new) frontend mirror; `lib/storefront-api.js` register +
  merchant methods.
- `app/login/page.js`, `app/register/page.js`, `app/merchant/page.js` (new).
- `app/StorefrontNav.js` (new) shared nav with auth state + merchant link.
- `app/storefront/workspace.js`, `app/sell/page.js`,
  `app/passport/[pcxId]/page.js`: use shared nav.
- `lib/format.js`: BDT `৳` currency (earlier fix).

## Verification

| Check | Result |
|---|---|
| `node --test packages/domain/test/identity-role-policy.test.mjs` | 7 pass |
| `node --test apps/api/test/user-admin-service.test.mjs apps/api/test/merchant-listing-service.test.mjs` | 8 pass |
| `node --test apps/api/test/integration/migrations.test.mjs apps/api/test/integration/listing-repository.test.mjs` (with env) | 2 pass |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run security` | pass |
| `npm run db:migrate` (with env) | current |

## Known pre-existing failures (NOT from this work)

- `npm run build` fails at `/_global-error` prerender
  (`TypeError: Cannot read properties of null (reading 'useContext')`).
  Reproduced identically on a clean `git stash` tree — pre-existing.
- `auth-http` login Secure-cookie test fails when `NODE_ENV=development`
  (`.env`-driven); passes with `NODE_ENV=production`.
- `catalog-repository` & `scripts/ai-adapters` tests fail on shared-dev-DB /
  environment state; untouched by this work.

## Risks / follow-ups

- MERCHANT role is new; admin `identity:read/manage` endpoints are gated and
  audited, but full integration coverage against a fresh TEST_DATABASE_URL is
  recommended.
- `packages/domain/src/identity/index.mjs` added but frontend currently uses
  its own `lib/access.js` mirror to avoid Next.js `transpilePackages` issues.
  Keep the two in sync if policy changes.
- No ADR written for price path A / MERCHANT addition — consider a short ADR if
  this becomes business truth.

## Next unbounded tasks (dependency-ready)

1. Integration tests for user-admin repository (need isolated TEST_DATABASE_URL).
2. Admin listing approval flow (link merchant draft -> inventory -> publish +
   record final price).
3. Fix pre-existing Next.js `/_global-error` build failure.
