import pg from "pg";
import { createAuthRuntime } from "./modules/identity/auth-runtime.mjs";
import { createApiServer } from "./server.mjs";
import { createDevMfa } from "./modules/identity/dev-mfa.mjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://pcx:pcx_local_only@localhost:5432/pcx";
// Browser origins allowed to call the API from the storefront/admin apps.
// `PCX_API_ORIGIN` is the API's own address and is no longer reused for CORS.
const allowedOrigins = process.env.API_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001";
const port = Number(process.env.API_PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";

// Local development only: a deterministic MFA adapter lets a privileged demo
// admin complete login without a real SMS/TOTP provider. Production never
// wires this, so privileged login keeps failing closed (mfa_unavailable).
const mfa = isProduction ? undefined : createDevMfa();

const pool = new pg.Pool({ connectionString, max: 10 });

const delivery = {
  async send() {
    // Local no-op identity-action delivery for development viewing only.
    return { ok: true };
  }
};

const runtime = createAuthRuntime({ pool, allowedOrigins, delivery, mfa });

const readiness = async () => {
  try {
    await pool.query("select 1");
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

const server = createApiServer({ ...runtime, readiness });
server.listen(port, () => process.stdout.write(`PCX API listening on ${port}\n`));
