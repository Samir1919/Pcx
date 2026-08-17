import pg from "pg";
import { createWorkerRuntime } from "./composition.mjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://pcx:pcx_local_only@localhost:5432/pcx";
const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000, query_timeout: 15_000, statement_timeout: 15_000 });
const runtime = createWorkerRuntime({ pool, onError: console.error, unref: false });
runtime.worker.start();
process.stdout.write("PCX worker running\n");
