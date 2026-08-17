import { execFile } from "node:child_process";
import { promisify } from "node:util";

await import("../apps/api/src/server.mjs");
await import("../apps/worker/src/worker.mjs");
await promisify(execFile)(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build", "--workspace", "@pcx/admin"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180_000,
    env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" }
  }
);
process.stdout.write("Application boundaries load successfully\n");
