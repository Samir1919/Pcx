import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

// 1. Root package policy.
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (!packageJson.private || packageJson.type !== "module") throw new Error("Root package policy failed");

// 2. Merge-conflict marker guard (the "stuck / corrupted file" guard).
// Never allow a tracked source file with unresolved `<<<<<<<`, `=======`,
// or `>>>>>>>` conflict markers to pass. This fails any workflow that would
// otherwise commit or report an incomplete merge.
const EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".css", ".scss", ".md", ".json", ".sql", ".html"]);
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "coverage", ".worktrees", "outputs", ".playwright-mcp"]);

const conflictRegex = /^(<<<<<<< |=======|>>>>>>> )/m;

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      yield full;
    }
  }
}

const conflicts = [];
for await (const file of walk(".")) {
  const text = await readFile(file, "utf8");
  if (conflictRegex.test(text)) conflicts.push(relative(".", file));
}

if (conflicts.length > 0) {
  process.stderr.write(`Unresolved merge conflict markers found in:\n  ${conflicts.join("\n  ")}\n`);
  process.exit(1);
}

// 3. Async `event.currentTarget` guard. React nullifies SyntheticEvent.currentTarget
// after the synchronous part of a handler, so a call like `event.currentTarget.reset()`
// placed after an `await` throws "Cannot read properties of null" (the admin
// create/save forms failed this way — the config saved, then the reset threw and
// the UI showed an error instead of refreshing). The safe pattern captures the
// element synchronously (const formElement = event.currentTarget). Flag the direct
// `.reset()` call so the bug cannot be re-introduced.
const currentTargetResetRegex = /event\.currentTarget\.reset\s*\(/;
const asyncCurrentTargetViolations = [];
for (const dir of ["apps/admin", "apps/web"]) {
  for await (const file of walk(dir)) {
    const text = await readFile(file, "utf8");
    if (currentTargetResetRegex.test(text)) asyncCurrentTargetViolations.push(relative(".", file));
  }
}

if (asyncCurrentTargetViolations.length > 0) {
  process.stderr.write(`Async event.currentTarget.reset() found (capture the element synchronously instead):\n  ${asyncCurrentTargetViolations.join("\n  ")}\n`);
  process.exit(1);
}

process.stdout.write("Lint policy check passed\n");
