/**
 * One-command local development cleanup ("clean shutdown").
 *
 * `node scripts/dev.mjs` (npm run dev) starts the local infra containers
 * (PostgreSQL, Redis, MinIO), runs migrations, then starts the API, customer
 * web, admin web, and worker as host processes. Its own Ctrl+C handler stops
 * the host children, but it never stops the infra containers itself, and a
 * backgrounded/abandoned dev stack can leave orphan processes holding ports
 * 4000/3000/3001 (the usual cause of EADDRINUSE on the next run).
 *
 * This script is the mirror "off switch":
 *   1. Stops the host dev processes (orchestrator, api, web, admin, worker)
 *      by signal, with SIGINT first and SIGKILL as a fallback.
 *   2. Stops/removes the local infra containers via docker compose.
 *
 * It only ever touches the local dev stack. It never deploys, never touches
 * production/staging, never deletes volumes or data, and never contacts real
 * credentials. By default it runs `docker compose down` (removes the local dev
 * containers but keeps named volumes, so data survives). Pass `--stop` to only
 * stop containers instead of removing them, and `--no-infra` to skip the
 * container step entirely.
 *
 * Usage:
 *   node scripts/dev-down.mjs            # full clean down
 *   node scripts/dev-down.mjs --stop     # stop containers without removing
 *   node scripts/dev-down.mjs --no-infra # stop only host processes
 */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = process.cwd();
const INFRA_COMPOSE = "infra/docker-compose.yml";
const HOST_PORTS = { api: 4000, web: 3000, admin: 3001 };
const HOST_PATTERNS = {
  orchestrator: "scripts/dev.mjs",
  worker: "apps/worker/src/main.mjs"
};

const execFileAsync = promisify(execFile);

const defaultWait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const defaultKill = (pid, signal) => process.kill(pid, signal);

/** Dedupe a list of string ids and drop empty values. */
export const uniqueIds = (list) => [...new Set((list ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean))];

/** Parse newline-delimited `lsof -t` / `pgrep` output into a list of numeric PIDs. */
export const parsePidLines = (stdout) => uniqueIds((stdout ?? "").split("\n")).filter((line) => /^\d+$/.test(line));

/**
 * Resolve PIDs listening on a TCP port. Defaults to `lsof -t` and returns an
 * empty list when nothing is listening (lsof exits non-zero in that case).
 */
export const findPidsOnPort = async (port, run = execFileAsync) => {
  try {
    const { stdout } = await run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return parsePidLines(stdout);
  } catch {
    return [];
  }
};

/** Resolve PIDs by full command-line pattern. Defaults to `pgrep -f`. */
export const findPidsByPattern = async (pattern, run = execFileAsync) => {
  try {
    const { stdout } = await run("pgrep", ["-f", pattern]);
    return parsePidLines(stdout);
  } catch {
    return [];
  }
};

/**
 * Signal a process gracefully then force-kill if it is still alive.
 * Returns true when the process is gone (or was never present) afterward.
 */
export const gracefulKill = async ({
  pid,
  signal = "SIGINT",
  forceSignal = "SIGKILL",
  waitMs = 250,
  kill = defaultKill,
  wait = defaultWait
}) => {
  const numericPid = Number(pid);
  try {
    kill(numericPid, signal);
  } catch {
    return true;
  }
  await wait(waitMs);
  try {
    kill(numericPid, 0);
  } catch {
    return true; // ESRCH: no longer running
  }
  try {
    kill(numericPid, forceSignal);
    return true;
  } catch {
    return true;
  }
};

/**
 * Stop labeled groups of host processes. `groups` is a map from label to an
 * array of PIDs. `excludePid` (typically the current process) is never signalled.
 * Returns a report of what was attempted.
 */
export const stopHostProcesses = async ({
  groups,
  excludePid = process.pid,
  killProcess = (pid) => gracefulKill({ pid })
}) => {
  const report = {};
  for (const [label, pids] of Object.entries(groups ?? {})) {
    const targets = uniqueIds(pids).filter((pid) => Number(pid) !== Number(excludePid));
    const stopped = [];
    for (const pid of targets) {
      stopped.push({ pid: Number(pid), ok: await killProcess(Number(pid)) });
    }
    report[label] = { pids: targets.map(Number), stopped };
  }
  return report;
};

const runSpawn = (command, args) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code) => (code === 0 ? resolveRun() : rejectRun(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
  });

/** Stop or remove (down) the local infra containers. */
export const stopInfraContainers = async ({ mode = "down", runCommand = runSpawn } = {}) => {
  const action = mode === "stop" ? "stop" : "down";
  await runCommand("docker", ["compose", "-f", INFRA_COMPOSE, action]);
  return { action };
};

/**
 * Resolve every host dev process group by port or command-line pattern.
 * Returns a map in the same shape `stopHostProcesses` expects.
 */
export const resolveHostGroups = async ({
  findPort = findPidsOnPort,
  findPattern = findPidsByPattern
} = {}) => ({
  orchestrator: await findPattern(HOST_PATTERNS.orchestrator),
  api: await findPort(HOST_PORTS.api),
  web: await findPort(HOST_PORTS.web),
  admin: await findPort(HOST_PORTS.admin),
  worker: await findPattern(HOST_PATTERNS.worker)
});

const printHostReport = (report) => {
  for (const [label, entry] of Object.entries(report)) {
    const count = entry.stopped.length;
    process.stdout.write(`[dev:down] ${label}: ${count > 0 ? `stopped ${count} (pids ${entry.pids.join(", ")})` : "not running"}\n`);
  }
};

const main = async () => {
  const mode = process.argv.includes("--stop") ? "stop" : "down";
  const noInfra = process.argv.includes("--no-infra");

  process.stdout.write("[dev:down] resolving local dev processes…\n");
  const groups = await resolveHostGroups();

  process.stdout.write("[dev:down] stopping host processes…\n");
  const hostReport = await stopHostProcesses({ groups, excludePid: process.pid });
  printHostReport(hostReport);

  if (noInfra) {
    process.stdout.write("[dev:down] --no-infra set: skipping infra container cleanup.\n");
  } else {
    process.stdout.write(`[dev:down] stopping infra containers (${mode})…\n`);
    await stopInfraContainers({ mode });
    process.stdout.write("[dev:down] infra containers stopped.\n");
  }

  process.stdout.write("[dev:down] done.\n");
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`[dev:down] failed: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
