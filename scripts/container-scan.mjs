import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execFileP = promisify(execFile);

// Candidate container image names, in priority order. The scan runs against the
// first image that actually exists locally. If no image exists, the scan skips
// safely (the acceptance criterion) rather than failing the gate.
const CANDIDATE_IMAGES = ["pcx-api:latest", "pcx-web:latest", "pcx-worker:latest"];

// A Dockerfile anywhere in the repo signals that a container image is expected.
function hasDockerfile(root = process.cwd()) {
  const candidates = [
    join(root, "Dockerfile"),
    join(root, "apps", "api", "Dockerfile"),
    join(root, "apps", "web", "Dockerfile"),
    join(root, "apps", "worker", "Dockerfile")
  ];
  return candidates.some((path) => existsSync(path));
}

async function imageExists(image, run = execFileP) {
  try {
    await run("docker", ["image", "inspect", image], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function scanWithDockerScout(image, run = execFileP) {
  const { stdout } = await run("docker", ["scout", "cves", image], { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

async function scanWithTrivy(image, run = execFileP) {
  const { stdout } = await run("trivy", ["image", "--no-progress", image], { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

async function hasCommand(command, run = execFileP) {
  try {
    await run(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Core scan logic, dependency-injected for testability. Returns a result object
// describing whether the scan ran, skipped, or failed.
export async function runContainerScan({ root = process.cwd(), run = execFileP, images = CANDIDATE_IMAGES } = {}) {
  if (!hasDockerfile(root)) {
    return { status: "skipped", reason: "no_dockerfile", message: "No Dockerfile found; container image scan skipped." };
  }

  let image = null;
  for (const candidate of images) {
    if (await imageExists(candidate, run)) { image = candidate; break; }
  }
  if (!image) {
    return { status: "skipped", reason: "no_image", message: "No container image is built locally; scan skipped. Build an image to scan it." };
  }

  let output;
  try {
    if (await hasCommand("docker", run)) {
      output = await scanWithDockerScout(image, run);
    } else if (await hasCommand("trivy", run)) {
      output = await scanWithTrivy(image, run);
    } else {
      return { status: "skipped", reason: "no_scanner", message: `Image ${image} exists but no scanner (docker scout/trivy) is available; scan skipped.` };
    }
  } catch (error) {
    return { status: "failed", reason: "scan_error", message: `Container scan failed for ${image}: ${error.message}` };
  }
  return { status: "scanned", image, output };

}

// CLI entrypoint.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await runContainerScan();
  process.stdout.write(`${result.message}\n`);
  if (result.status === "scanned") process.stdout.write(`${result.output}\n`);
  if (result.status === "failed") process.exitCode = 1;
}
