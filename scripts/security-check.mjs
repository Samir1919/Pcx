import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

// Secret scanning is deterministic internal logic; dependency auditing uses npm.
await execFileP(process.execPath, ["scripts/secret-scan.mjs"], { stdio: "inherit" });
await execFileP(npm, ["audit", "--omit=dev", "--audit-level=high"], { stdio: "inherit" });
process.stdout.write("Security scan passed (secrets + dependencies)\n");
