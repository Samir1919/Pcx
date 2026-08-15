# Admin and Technician Web

Responsive Next.js boundary for privileged operations. Authorization is always enforced by the API, never only by this client.

Run locally with `npm run dev --workspace @pcx/admin`. Browser `/api` requests are forwarded to `PCX_API_ORIGIN` (default `http://127.0.0.1:4000`), so configure the API's exact allowed origin for the admin URL.

The current `/catalog` workspace manages active categories, brands, ProductModels and specification definitions. It intentionally excludes serials, acquisition cost, health, grade, price and other physical-item facts.
