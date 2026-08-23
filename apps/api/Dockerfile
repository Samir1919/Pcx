# PCX API image. The API is a plain-JS Node 22 module that composes the shared
# domain package via relative imports and depends on `pg` + `argon2` (native).
#
# Build from the repository root so npm workspaces and relative imports resolve:
#   docker build -f apps/api/Dockerfile -t pcx-api:latest .

FROM node:24.19.0-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install the API workspace's own dependencies only. `argon2` compiles a native
# binding, so build tools are present only for the install step and removed
# afterward to keep the runtime image small.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN apk add --no-cache python3 make g++ \
  && npm ci --workspace @pcx/api --omit=dev \
  && apk del python3 make g++

# Copy only the source the API composes (its modules plus the shared domain).
COPY apps/api apps/api
COPY packages/domain packages/domain

USER node
EXPOSE 4000
CMD ["node", "apps/api/src/index.mjs"]
