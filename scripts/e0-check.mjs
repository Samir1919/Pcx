import { access, readFile } from "node:fs/promises";

const required = [
  "AGENTS.md", "README.md", "package.json", "package-lock.json", ".env.example",
  "apps/web/package.json", "apps/admin/package.json", "apps/api/package.json", "apps/worker/package.json",
  "packages/domain/package.json", "packages/ui/package.json", "packages/config/package.json", "packages/testing/package.json",
  "infra/docker-compose.yml", ".github/workflows/ci.yml", "docs/brain/README.md", "docs/brain/domain-rules.md",
  "docs/brain/security.md", "docs/brain/state-machines.md", "docs/adr/0001-modular-monolith.md",
  "docs/specifications/PROJECT_BRAIN_AGENTIC_SYSTEM.md"
];

for (const file of required) await access(file);
const agents = await readFile("AGENTS.md", "utf8");
if (!agents.includes("Hard stops") || !agents.includes("cannot be sold twice")) throw new Error("AGENTS.md is missing mandatory controls");
process.stdout.write(`E0 verified: ${required.length} required artifacts\n`);
