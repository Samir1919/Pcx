# PCX worker image. The worker is a plain-JS Node 22 module in the monorepo;
# it needs the shared domain package and the api service/repository modules it
# composes, plus `pg`. No build step is required.
#
# Build from the repository root so npm workspaces resolve:
#   docker build -f apps/worker/Dockerfile -t pcx-worker:latest .
#
# The root `.dockerignore` keeps `.env`, node_modules, git, and logs out of the
# build context so secrets never reach the image.

FROM node:22-alpine

WORKDIR /app

# Install only the worker workspace's own dependencies (`pg`) for a minimal
# image. The worker composes api/domain modules via relative source copies and
# does not need the api's argon2 or any web/admin UI dependencies.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/testing/package.json packages/testing/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --workspace @pcx/worker --omit=dev

# Copy the application source needed by the worker (the api modules it composes
# and the shared domain package). Kept explicit to minimize image surface.
COPY apps/worker apps/worker
COPY apps/api apps/api
COPY packages/domain packages/domain

# The worker owns no business truth; it only advances PostgreSQL state the
# services already own. Run the daemon entrypoint (no top-level await).
CMD ["node", "apps/worker/src/main.mjs"]
