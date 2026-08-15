import { execFile } from "node:child_process";
import { promisify } from "node:util";

await import("../apps/api/src/server.mjs");
await import("../apps/worker/src/worker.mjs");
await promisify(execFile)(process.platform==="win32"?"npm.cmd":"npm",["run","build","--workspace","@pcx/admin"],{cwd:new URL("..",import.meta.url)});
process.stdout.write("Application boundaries load successfully\n");
