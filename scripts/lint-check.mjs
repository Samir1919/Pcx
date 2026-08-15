import { readFile } from "node:fs/promises";
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (!packageJson.private || packageJson.type !== "module") throw new Error("Root package policy failed");
process.stdout.write("Lint policy check passed\n");
