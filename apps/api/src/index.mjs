import pg from "pg";
import { createAuthRuntime } from "./modules/identity/auth-runtime.mjs";
import { createApiServer } from "./server.mjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://pcx:pcx_local_only@localhost:5432/pcx";
const allowedOrigins = process.env.PCX_API_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000";
const port = Number(process.env.API_PORT || 4000);

const pool = new pg.Pool({ connectionString, max: 10 });

const delivery = {
  async send() {
    // Local no-op identity-action delivery for development viewing only.
    return { ok: true };
  }
};

const runtime = createAuthRuntime({ pool, allowedOrigins, delivery });

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
