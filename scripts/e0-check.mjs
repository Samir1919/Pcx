import { access, readFile } from "node:fs/promises";

const required = [
  "AGENTS.md", "README.md", "package.json", "package-lock.json", ".env.example",
  "apps/web/package.json", "apps/admin/package.json", "apps/api/package.json", "apps/worker/package.json",
  "packages/domain/package.json", "packages/ui/package.json", "packages/config/package.json", "packages/testing/package.json",
  "infra/docker-compose.yml", ".github/workflows/ci.yml", "docs/brain/README.md", "docs/brain/domain-rules.md",
  "docs/brain/security.md", "docs/brain/state-machines.md", "docs/adr/0001-modular-monolith.md",
  "docs/specifications/PROJECT_BRAIN_AGENTIC_SYSTEM.md", "docs/agentic/PORTABLE_AGENT_WORKFLOW.md",
  "docs/agentic/START_PROMPT.md", "docs/agentic/TASK_SPEC_TEMPLATE.md", "docs/agentic/HANDOFF_TEMPLATE.md",
  "docs/agentic/MULTI_AGENT_SYSTEM.md", "CLAUDE.md", "GEMINI.md", "CONVENTIONS.md", ".clinerules",
  "docs/agentic/AUTONOMY_EVOLUTION_ROADMAP.md",
  ".windsurfrules", ".roo/rules/pcx.md", ".github/copilot-instructions.md", ".cursor/rules/pcx.mdc", ".vscode/tasks.json"
];

const missing = [];
for (const file of required) {
  try {
    await access(file);
  } catch {
    missing.push(file);
  }
}
if (missing.length > 0) throw new Error(`E0 verification failed: missing required artifact(s):\n  ${missing.join("\n  ")}`);
const agents = await readFile("AGENTS.md", "utf8");
if (!agents.includes("Hard stops") || !agents.includes("cannot be sold twice")) throw new Error("AGENTS.md is missing mandatory controls");
if (!agents.includes("tool-neutral") || !agents.includes("Portable completion record")) throw new Error("AGENTS.md is missing portable agent controls");
process.stdout.write(`E0 verified: ${required.length} required artifacts\n`);
