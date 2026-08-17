/**
 * Single-command production/container runner.
 *
 * Reuses the same Dockerfiles in both development and production so there is
 * one build path. The production stack runs from the standalone
 * `infra/docker-compose.prod.yml` (project `pcx-prod`), which is isolated from
 * the development stack in `infra/docker-compose.yml`. Subcommands:
 *
 *   build  — build api/web/admin/worker images
 *   up     — start the full production stack (runs migrations first)
 *   down   — stop the full stack
 *   deploy — `git pull` then build then up (one command on the production host)
 *
 * This runner only orchestrates local container operations. It performs no
 * real secret management and never deploys to an external production host on
 * its own. Real production deployment, domains/TLS, and real credentials are
 * human-approval hard stops in this repository.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const PROD_ENV = "infra/.env";
const PROD_ENV_EXAMPLE = "infra/.env.example";
// Prefer a real `infra/.env` when present, otherwise use the checked-in example
// so the production stack never silently inherits the repository-root `.env`
// (which holds the development database URL).
const envFile = existsSync(PROD_ENV) ? PROD_ENV : PROD_ENV_EXAMPLE;
const COMPOSE_ARGS = ["--project-directory", ROOT, "--env-file", envFile, "-f", "infra/docker-compose.prod.yml"];

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
  });

const build = (extraArgs = []) => run("docker", ["compose", ...COMPOSE_ARGS, "build", ...extraArgs]);
const up = (extraArgs = []) => run("docker", ["compose", ...COMPOSE_ARGS, "up", "-d", ...extraArgs]);
const down = () => run("docker", ["compose", ...COMPOSE_ARGS, "down"]);

const main = async () => {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (subcommand === "build") {
    await build(rest);
    return;
  }
  if (subcommand === "up") {
    await up(rest.includes("--build") ? ["--build"] : []);
    return;
  }
  if (subcommand === "down") {
    await down();
    return;
  }
  if (subcommand === "deploy") {
    process.stdout.write("[prod] pulling latest code…\n");
    await run("git", ["pull", "--ff-only"]);
    process.stdout.write("[prod] building images…\n");
    await build();
    process.stdout.write("[prod] starting stack…\n");
    await up(["--build"]);
    return;
  }

  process.stderr.write(
    "usage: node scripts/prod.mjs <build|up|down|deploy>\n" +
    "  build            build production images\n" +
    "  up [--build]     start the production stack (runs migrations)\n" +
    "  down             stop the production stack\n" +
    "  deploy           git pull --ff-only, build, and up (on the production host)\n"
  );
  process.exitCode = 2;
};

main().catch((error) => {
  process.stderr.write(`[prod] failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
