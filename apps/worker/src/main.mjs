import pg from "pg";
import { createWorkerRuntime } from "./composition.mjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://pcx:pcx_local_only@localhost:5432/pcx";
const pool = new pg.Pool({ connectionString, max: 10 });
const runtime = createWorkerRuntime({ pool, unref: false });
runtime.worker.start();
process.stdout.write("PCX worker running\n");
