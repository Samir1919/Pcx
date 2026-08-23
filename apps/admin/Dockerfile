# PCX admin web (Next.js) image.
#
# Build from the repository root:
#   docker build -f apps/admin/Dockerfile -t pcx-admin:latest .
#
# The app already configures Next.js `output: "standalone"`, so the runner
# stage only needs the standalone server and static assets.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci --workspace @pcx/admin

FROM deps AS builder
WORKDIR /app
# The Next.js `rewrites()` in next.config.mjs is evaluated at build time, so
# the API origin must be baked here. Override with `--build-arg PCX_API_ORIGIN=…`.
ARG PCX_API_ORIGIN=http://api:4000
ENV PCX_API_ORIGIN=$PCX_API_ORIGIN
COPY apps/admin apps/admin
RUN npm run build -w @pcx/admin

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone reads `PORT`; keep it aligned with the compose mapping.
ENV PORT=3001
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static

USER node
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
