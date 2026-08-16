# Customer Web (Storefront)

Responsive Next.js storefront for the PCX certified pre-owned marketplace. Consumes the public read surface only:

- `GET /api/v1/categories`, `GET /api/v1/brands`
- `GET /api/v1/listings` (published listing search with filter/sort/cursor pagination)
- `GET /api/v1/passport/:pcxId` (public passport)

The storefront is read-only and never renders serials, acquisition cost, or private evidence. Prices are server-set by PCX.

## Run

```sh
npm run dev --workspace @pcx/web
```

The app proxies `/api/:path*` to the API origin (`PCX_API_ORIGIN`, default `http://127.0.0.1:4000`).
