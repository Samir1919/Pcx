/**
 * One-command local development runner (Docker-first).
 *
 * Default: builds and starts the full stack (Postgres, Redis, MinIO, migrate,
 * api, web, admin, worker) via Docker Compose, then follows logs. The app
 * services use the same Node 24 images as production, so local dev matches
 * production and no host Node/Next build is required.
 *
 * Opt out with `--host` to run the previous host-process mode only for
 * isolated diagnostics (requires matching host tooling).
 *
 * This is development only. It never deploys to production and never touches
 * real credentials. The production path is `scripts/prod.mjs`.
 */
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const INFRA_COMPOSE = "infra/docker-compose.yml";
const hostMode = process.argv.includes("--host");

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
  });

const main = async () => {
  if (hostMode) {
    process.stdout.write("[dev] --host mode: running apps on the host (diagnostics only)…\n");
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    await runCommand("docker", ["compose", "-f", INFRA_COMPOSE, "up", "-d", "postgres", "redis", "minio"]);
    await runCommand(npmBin, ["run", "db:migrate"]);
    await runCommand(npmBin, ["run", "dev:api"]);
    return;
  }

  process.stdout.write("[dev] docker-first: building and starting the full stack…\n");
  await runCommand("docker", ["compose", "-f", INFRA_COMPOSE, "up", "-d", "--build"]);

  process.stdout.write("[dev] running pending migrations via the migrate service…\n");
  await runCommand("docker", ["compose", "-f", INFRA_COMPOSE, "run", "--rm", "migrate"]);

  process.stdout.write("[dev] following logs (Ctrl+C to stop following; containers keep running)…\n");
  const logs = spawn("docker", ["compose", "-f", INFRA_COMPOSE, "logs", "-f", "--tail=100"], { cwd: ROOT, env: process.env, stdio: "inherit" });
  const stopFollowing = () => { if (logs && !logs.killed) logs.kill("SIGINT"); };
  process.on("SIGINT", stopFollowing);
  process.on("SIGTERM", stopFollowing);
  await new Promise((resolve) => logs.on("exit", resolve));
};

main().catch((error) => {
  process.stderr.write(`[dev] failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
