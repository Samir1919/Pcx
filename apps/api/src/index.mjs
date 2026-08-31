import pg from "pg";
import { createAuthRuntime } from "./modules/identity/auth-runtime.mjs";
import { createApiServer } from "./server.mjs";
import { createDevMfa } from "./modules/identity/dev-mfa.mjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://pcx:pcx_local_only@localhost:5432/pcx";
// Browser origins allowed to call the API from the storefront/admin apps.
// `PCX_API_ORIGIN` is the API's own address and is no longer reused for CORS.
const allowedOrigins = process.env.API_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001";
const adminOrigins = process.env.API_ADMIN_ORIGINS ?? "http://localhost:3001,http://127.0.0.1:3001,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8083,http://127.0.0.1:8083";
const port = Number(process.env.API_PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";

// Local development only: a deterministic MFA adapter lets a privileged demo
// admin complete login without a real SMS/TOTP provider. Production never
// wires this, so privileged login keeps failing closed (mfa_unavailable).
const mfa = isProduction ? undefined : createDevMfa();

// Bound every connection and query so an unreachable/hung Postgres cannot hold
// a request handler (including /health/ready) open indefinitely.
const pool = new pg.Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 5_000,
  query_timeout: 15_000,
  statement_timeout: 15_000
});

const delivery = {
  async send() {
    // Local no-op identity-action delivery for development viewing only.
    return { ok: true };
  }
};

const runtime = createAuthRuntime({ pool, allowedOrigins, adminOrigins, delivery, mfa });

// The readiness probe itself is bounded with an explicit timeout in addition to
// the pool's query/statement timeouts, so it always answers instead of hanging.
const readiness = async () => {
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("readiness timeout")), 3_000).unref())
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

const server = createApiServer({ ...runtime, readiness });
server.listen(port, () => process.stdout.write(`PCX API listening on ${port}\n`));
