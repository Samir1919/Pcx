/**
 * One-command local development runner.
 *
 * Brings up the local infrastructure containers (PostgreSQL, Redis, MinIO),
 * runs pending database migrations, then starts the API, customer web, admin
 * web, and worker as host processes with prefixed, interleaved stdout/stderr.
 * Pressing Ctrl+C (SIGINT/SIGTERM) stops every child process cleanly.
 *
 * This is development only. It never deploys to production and never touches
 * real credentials. The production path is `scripts/prod.mjs`.
 */
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const INFRA_COMPOSE = "infra/docker-compose.yml";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const PROCESSES = [
  {
    label: "api",
    command: "node",
    args: ["apps/api/src/index.mjs"],
    env: { PCX_API_ORIGIN: "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001" }
  },
  { label: "web", command: npmBin, args: ["run", "dev", "-w", "@pcx/web", "--", "-p", "3000"], env: {} },
  { label: "admin", command: npmBin, args: ["run", "dev", "-w", "@pcx/admin", "--", "-p", "3001"], env: {} },
  { label: "worker", command: npmBin, args: ["run", "dev:worker"], env: {} }
];

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: options.inherit === false ? "ignore" : "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
  });

const startApp = ({ label, command, args, env = {} }) => {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `[${label}]`;
  const emitPrefix = (stream) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      let index = buffer.indexOf("\n");
      while (index !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        if (line.trim() !== "") process.stdout.write(`${prefix} ${line}\n`);
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf("\n");
      }
    });
  };
  emitPrefix(child.stdout);
  emitPrefix(child.stderr);
  return child;
};

const main = async () => {
  if (process.argv.includes("--no-infra")) {
    process.stdout.write("[dev] --no-infra set: skipping infrastructure bring-up.\n");
  } else {
    process.stdout.write("[dev] starting local infrastructure (postgres, redis, minio)…\n");
    await runCommand("docker", ["compose", "-f", INFRA_COMPOSE, "up", "-d", "postgres", "redis", "minio"]);
  }

  process.stdout.write("[dev] running database migrations…\n");
  await runCommand(npmBin, ["run", "db:migrate"]);

  process.stdout.write("[dev] starting api, web, admin, worker (Ctrl+C to stop)…\n");
  const children = PROCESSES.map(startApp);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write("\n[dev] stopping all child processes…\n");
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGINT");
    }
    const force = setTimeout(() => {
      for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }
      process.exit(0);
    }, 3000);
    force.unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  for (const child of children) {
    child.on("exit", (code, signal) => {
      if (!shuttingDown) {
        process.stderr.write(`[dev] a child process exited (code=${code}, signal=${signal}); stopping the rest.\n`);
        shutdown();
      }
    });
  }
};

main().catch((error) => {
  process.stderr.write(`[dev] failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
