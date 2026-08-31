# ADR 0013: Surface-scoped session cookies for storefront and admin

- Status: Accepted
- Date: 2026-08-31

## Context

The storefront (`apps/web`) and admin control room (`apps/admin`) are two separate browser surfaces served from one hostname with only a port to tell them apart in development and in the production/staging compose (Caddy exposes `:8080` for storefront and `:8081` for admin). Browsers store cookies against the host and ignore the port, so the host-only session cookies issued by `auth-http.mjs` (`pcx_access`, `pcx_refresh`, `pcx_csrf`, `pcx_device`) collide: signing into one surface overwrites the other surfaces session and forces a logout. An operator could not keep a customer session and an admin session open in the same browser at the same time.

## Decision

Give each surface its own session-cookie namespace, derived from the request `Origin` (which the auth boundary already validates against the allow-list):

- Storefront keeps the canonical names: `pcx_access`, `pcx_refresh`, `pcx_csrf`, `pcx_device`.
- Admin uses the `pcx_admin_` prefix: `pcx_admin_access`, `pcx_admin_refresh`, `pcx_admin_csrf`, `pcx_admin_device`.

A new `API_ADMIN_ORIGINS` environment variable lists the admin origins (defaults cover dev, prod and staging ports). `cookie-surface.mjs` centralizes two operations:

1. `normalizeCookieHeader` rewrites the inbound `Cookie` header at the single request-entry choke point (`server.mjs`) so every downstream HTTP module keeps reading the canonical `pcx_*` names regardless of surface, while dropping the other surfaces session cookies. This keeps the change off the ~28 module handlers.
2. `cookieName` selects the surface-appropriate name when `auth-http.mjs` issues or clears cookies.

The admin API client reads the `pcx_admin_csrf` cookie for its double-submit token; the storefront client keeps reading `pcx_csrf`.

## Consequences

- One browser can hold a customer session and an admin session simultaneously.
- `API_ADMIN_ORIGINS` must be configured correctly in every environment; an unset/empty value means no admin surface (everything is treated as storefront, preserving the pre-ADR shared-cookie behaviour).
- Cookie issuance and parsing tests now cover both surfaces plus the storefront/admin coexistence cases.
