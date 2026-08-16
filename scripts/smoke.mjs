import { once } from "node:events";
import pg from "pg";
import { runMigrations } from "../apps/api/src/infrastructure/database/migrate.mjs";
import { createAuthRuntime } from "../apps/api/src/modules/identity/auth-runtime.mjs";
import { createApiServer } from "../apps/api/src/server.mjs";

const connectionString = process.env.SMOKE_DATABASE_URL
  ?? process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL;

if (!connectionString) {
  process.stdout.write("Smoke test skipped (no SMOKE_DATABASE_URL, TEST_DATABASE_URL, or DATABASE_URL)\n");
  process.exit(0);
}

async function getJson(origin, pathname) {
  const response = await fetch(`${origin}${pathname}`);
  const body = await response.json();
  return { status: response.status, body };
}

let server;
let pool;
try {
  await runMigrations({ connectionString });
  pool = new pg.Pool({ connectionString, max: 1 });
  const delivery = { async send() { } }; // smoke path never requests contact flows
  const runtime = createAuthRuntime({ pool, allowedOrigins: new Set(["http://127.0.0.1"]), delivery });

  server = createApiServer({ ...runtime, readiness: () => ({ ok: true }) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const live = await getJson(origin, "/health/live");
  if (live.status !== 200 || live.body?.status !== "ok") {
    throw new Error(`/health/live returned ${live.status}`);
  }

  const ready = await getJson(origin, "/health/ready");
  if (ready.status !== 200 || ready.body?.status !== "ready") {
    throw new Error(`/health/ready returned ${ready.status}`);
  }

  const categories = await getJson(origin, "/api/v1/categories");
  if (categories.status !== 200 || !Array.isArray(categories.body?.data) || categories.body.data.length === 0) {
    throw new Error(`/api/v1/categories did not return a non-empty list (${categories.status})`);
  }

  process.stdout.write(`Smoke test passed: ${categories.body.data.length} categories returned\n`);
} finally {
  if (server) server.close();
  if (pool) await pool.end();
}
