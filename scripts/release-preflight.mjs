import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredReadable = [
  "infra/docker-compose.staging.yml",
  "infra/staging.env.example",
  "scripts/db-backup.sh",
  "scripts/db-restore-drill.sh"
];

const forbiddenSecretMarkers = [
  "PASSWORD=change-me",
  "SECRET_KEY=change-me",
  "API_KEY=change-me"
];

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  const root = process.cwd();
  const missing = [];
  for (const rel of requiredReadable) {
    if (!(await exists(resolve(root, rel)))) missing.push(rel);
  }
  if (missing.length > 0) {
    console.error(`Release preflight failed: missing ${missing.join(", ")}`);
    process.exit(1);
  }
  const stagingExample = await readFile(resolve(root, "infra/staging.env.example"), "utf8");
  for (const marker of forbiddenSecretMarkers) {
    if (stagingExample.includes(marker)) {
      console.error("Release preflight failed: staging env example contains placeholder literal secret");
      process.exit(1);
    }
  }
  process.stdout.write("Release preflight passed: staging/backup/restore artifacts present, no placeholder secrets\n");
}

await main();
