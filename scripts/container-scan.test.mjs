import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runContainerScan } from "./container-scan.mjs";

function tempRoot(withDockerfile = false) {
  const dir = mkdtempSync(join(tmpdir(), "pcx-scan-"));
  if (withDockerfile) writeFileSync(join(dir, "Dockerfile"), "FROM node:22-alpine\n");
  return dir;
}

test("container scan skips safely when no Dockerfile exists", async () => {
  const root = tempRoot(false);
  try {
    const result = await runContainerScan({ root, run: async () => { throw new Error("should not run"); } });
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "no_dockerfile");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container scan skips safely when no image is built", async () => {
  const root = tempRoot(true);
  try {
    const result = await runContainerScan({
      root,
      images: ["pcx-api:latest"],
      run: async () => { throw new Error("image not found"); }
    });
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "no_image");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container scan runs docker scout when an image exists", async () => {
  const root = tempRoot(true);
  try {
    const calls = [];
    const run = async (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === "docker" && args[0] === "image") return { stdout: "" };
      if (cmd === "docker" && args[0] === "--version") return { stdout: "" };
      if (cmd === "docker" && args[0] === "scout") return { stdout: "No vulnerabilities found" };
      throw new Error("unexpected");
    };
    const result = await runContainerScan({ root, images: ["pcx-api:latest"], run });
    assert.equal(result.status, "scanned");
    assert.equal(result.image, "pcx-api:latest");
    assert.equal(result.output, "No vulnerabilities found");
    assert.ok(calls.some(([cmd, args]) => cmd === "docker" && args[0] === "scout"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container scan falls back to trivy when docker scout is unavailable", async () => {
  const root = tempRoot(true);
  try {
    const run = async (cmd, args) => {
      if (cmd === "docker" && args[0] === "image") return { stdout: "" };
      if (cmd === "docker" && args[0] === "--version") throw new Error("no docker");
      if (cmd === "trivy" && args[0] === "--version") return { stdout: "" };
      if (cmd === "trivy" && args[0] === "image") return { stdout: "trivy report" };
      throw new Error("unexpected");
    };
    const result = await runContainerScan({ root, images: ["pcx-api:latest"], run });
    assert.equal(result.status, "scanned");
    assert.equal(result.output, "trivy report");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container scan skips safely when docker scout requires login and trivy is absent", async () => {
  const root = tempRoot(true);
  try {
    const run = async (cmd, args) => {
      if (cmd === "docker" && args[0] === "image") return { stdout: "" };
      if (cmd === "docker" && args[0] === "--version") return { stdout: "" };
      if (cmd === "docker" && args[0] === "scout") {
        const error = new Error("scout requires login");
        error.stdout = "Log in with your Docker ID or email address to use docker scout.";
        throw error;
      }
      if (cmd === "trivy" && args[0] === "--version") throw new Error("command not found");
      throw new Error("unexpected");
    };
    const result = await runContainerScan({ root, images: ["pcx-worker:latest"], run });
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "no_scanner");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container scan reports a scan failure without crashing", async () => {
  const root = tempRoot(true);
  try {
    const run = async (cmd, args) => {
      if (cmd === "docker" && args[0] === "image") return { stdout: "" };
      if (cmd === "docker" && args[0] === "--version") return { stdout: "" };
      if (cmd === "docker" && args[0] === "scout") throw new Error("scanner crashed");
      throw new Error("unexpected");
    };
    const result = await runContainerScan({ root, images: ["pcx-api:latest"], run });
    assert.equal(result.status, "failed");
    assert.equal(result.reason, "scan_error");
    assert.match(result.message, /scanner crashed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
