/**
 * Staging compose smoke (no production deploy).
 *
 * Brings the full production-like staging stack up (synthetic credentials only),
 * waits for the API to be ready, verifies the web and admin proxies answer, then
 * tears the stack down. The staging stack is an isolated compose project
 * (`pcx-staging`) with its own ports/volumes so it never touches development or
 * production containers.
 *
 * Usage:
 *   npm run staging:smoke
 *
 * Real domains, TLS, and secrets are human-approval hard stops and are never
 * exercised here.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Mirror the working `scripts/dev.mjs` invocation: rely on cwd so `context: ..`
// in the compose file resolves to the repository root (the compose file lives in
// `infra/`). The compose file's `name: pcx-staging` provides project isolation.
const COMPOSE = ["-f", "infra/docker-compose.staging.yml"];

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}\n${stderr}${stdout}`))));
  });

async function waitFor(check, label, attempts = 60, delayMs = 3_000) {
  for (let i = 0; i < attempts; i += 1) {
    if (await check()) return;
    await sleep(delayMs);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function httpOk(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.ok || response.status >= 300; // a redirect to a real page is fine for the web proxy
  } catch {
    return false;
  }
}

async function main() {
  process.stdout.write("[staging-smoke] starting the isolated staging stack (build)…\n");
  try {
    await run("docker", ["compose", ...COMPOSE, "up", "-d", "--build"]);

    // API readiness: the internal `api` service has no host port, so probe it
    // through the container's own loopback using `wget` (same as its healthcheck).
    const apiReady = () =>
      run("docker", ["compose", ...COMPOSE, "exec", "-T", "api", "wget", "-qO-", "http://127.0.0.1:4000/health/ready"])
        .then(({ stdout }) => stdout.includes('"ready"'))
        .catch(() => false);
    await waitFor(apiReady, "api /health/ready");
    process.stdout.write("[staging-smoke] api ready\n");

    // Web + admin are reached through the Caddy proxy on host ports 8082/8083.
    await waitFor(() => httpOk("http://127.0.0.1:8082"), "web proxy");
    process.stdout.write("[staging-smoke] web proxy responding\n");

    await waitFor(() => httpOk("http://127.0.0.1:8083"), "admin proxy");
    process.stdout.write("[staging-smoke] admin proxy responding\n");

    const web = await fetch("http://127.0.0.1:8082", { redirect: "follow" });
    const admin = await fetch("http://127.0.0.1:8083", { redirect: "follow" });
    if (web.status >= 400) throw new Error(`web returned ${web.status}`);
    if (admin.status >= 400) throw new Error(`admin returned ${admin.status}`);

    process.stdout.write("[staging-smoke] PASS: api/web/admin healthy in the dockerized staging stack\n");
  } finally {
    process.stdout.write("[staging-smoke] tearing the staging stack down…\n");
    await run("docker", ["compose", ...COMPOSE, "down"]).catch(() => { });
  }
}

main().catch((error) => {
  process.stderr.write(`[staging-smoke] failed: ${error?.message ?? String(error)}\n`);
  process.exitCode = 1;
});
