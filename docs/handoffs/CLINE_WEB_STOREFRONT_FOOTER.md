# Agent Handoff: Admin-Configurable Dynamic Storefront Footer

- Status: Complete
- Branch: agent/web-storefront-footer
- Latest commit: c3bb7c6 feat(footer): admin-configurable dynamic storefront footer
- Date: 2026-08-22

## Outcome

The public storefront footer is now admin-configurable. An admin edits the
footer (tagline, copyright, contact details, trade license/BIN, social links,
and arbitrary link columns) from the admin panel's new **Footer** section, and
the storefront renders that content dynamically. The previous hard-coded
server-component footer is replaced by a client component that fetches
`GET /api/v1/footer` with a safe in-browser fallback.

## Changed areas

### API (new `footer` module)
- `apps/api/migrations/0033_site_footer.sql` — singleton `site_footer` table + default seed row.
- `apps/api/src/modules/footer/site-footer-service.mjs` — validation + authorization (`SYSTEM_CONFIGURE`), server-owned normalization.
- `apps/api/src/modules/footer/postgres-site-footer-repository.mjs` — active/public + admin projections and transactional upsert with audit.
- `apps/api/src/modules/footer/site-footer-http.mjs` — `GET /api/v1/footer` (public) and `GET/PUT /api/v1/admin/footer` (origin + double-submit CSRF for write).
- `apps/api/src/modules/identity/auth-runtime.mjs` + `apps/api/src/server.mjs` — wiring + route registration.

### Admin web
- `apps/admin/lib/site-footer-api.js` — API client.
- `apps/admin/app/(workspace)/footer/page.js` — structured editor (company details, social links, dynamic link columns).
- `apps/admin/app/user-shell.js` — added "Footer" nav item + icon.
- `apps/admin/app/globals.css` — added `.stack`, `.rowFields`, `.columnEditor`, `.formActions`, `.spread`.

### Customer web
- `apps/web/lib/storefront-api.js` — added `footer()`.
- `apps/web/app/StorefrontFooter.js` — client component fetching footer with fallback.
- `apps/web/app/globals.css` — added contact/social styles and fluid grid.

## Acceptance criteria

- [x] Public footer renders from `GET /api/v1/footer`.
- [x] Admin "Footer" section edits and persists the footer.
- [x] Server-validated content (no client-owned status, root-relative internal hrefs, http(s)-only social URLs).
- [x] Modular-monolith boundary honored (footer module owns only `site_footer`).

## Verification

| Command/test | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run verify:e0` | Pass (36 artifacts) |
| `npm test` | Pass (458 pass, 0 fail, 26 skipped) |
| `npm run web:check` | Pass (4 pages, no client errors) |
| Migration via `migrate.mjs` | Applied; `GET /api/v1/footer` returns seed |
| Playwright (1024px) | Footer visible, Shop/Account columns + links, no overflow |

## Architecture/security review

- Public footer endpoint is read-only GET, presentation-only DTO.
- Admin write requires `SYSTEM_CONFIGURE` and exact-origin + double-submit CSRF.
- Internal hrefs root-relative; social URLs http(s)-only; external links get `rel="noopener noreferrer"`.
- No schema/invariant/secret change.

## Schema/configuration/deployment

- Additive migration `0033_site_footer.sql`; run `db:migrate` on deploy.

## Remaining work and next safe action

- Optional admin preview of rendered footer (future slice).
- Optional `is_active` toggle UI.

## Blockers requiring human decision

None.
