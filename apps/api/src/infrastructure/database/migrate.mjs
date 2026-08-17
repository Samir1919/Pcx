import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../migrations");

export async function runMigrations({ connectionString, migrationsPath = migrationDirectory } = {}) {
  if (!connectionString) throw new TypeError("database connection string is required");
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
  try {
    const files = (await readdir(migrationsPath)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const file of files) {
      const sql = await readFile(resolve(migrationsPath, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await pool.query("SELECT checksum FROM schema_migrations WHERE version = $1", [file]);
      if (applied.rowCount > 0) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`applied migration checksum mismatch: ${file}`);
        continue;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [7132026]);
        const raced = await client.query("SELECT checksum FROM schema_migrations WHERE version = $1", [file]);
        if (raced.rowCount === 0) {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)", [file, checksum]);
        } else if (raced.rows[0].checksum !== checksum) {
          throw new Error(`applied migration checksum mismatch: ${file}`);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    return { applied: files.length };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations({ connectionString: process.env.DATABASE_URL });
  process.stdout.write("Database migrations are current\n");
}
