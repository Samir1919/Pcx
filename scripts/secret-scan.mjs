import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileP = promisify(execFile);

// Synthetic local/CI/test fixture values already committed and documented as
// non-production placeholders. They must not fail the scan.
const SYNTHETIC = /(local_only|change_?me|_ci_only|_test_only|dummy|example|placeholder|changeme|your[-_])/i;

// High-signal token formats are never legitimate in any committed file, so they
// are scanned everywhere (including tests and fixtures).
const tokenPatterns = [
  { name: "AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { name: "Stripe live secret key", re: /\bsk_live_[0-9a-zA-Z]{16,}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{12,}\b/g },
  { name: "Private key (PEM)", re: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/g }
];

// Generic assignment heuristic only matches quoted string literals. It is
// skipped for test/example/fixture files, which legitimately contain fake
// credentials, and further filtered by the synthetic allow-list.
const assignmentPattern = {
  name: "credential assignment",
  re: /(?:password|passwd|pwd|secret[_-]?key|api[_-]?key|access[_-]?(?:key|token)|private[_-]?key|client[_-]?secret|npm[_-]?token|auth[_-]?token|refresh[_-]?token)\s*[:=]\s*(['"])([^'"\n]{4,})\1/gi
};

function isNonCodeFixture(file) {
  return /\.test\.(?:mjs|cjs|js)$/.test(file)
    || file.includes("/test/")
    || file.includes("/tests/")
    || file.includes("/__fixtures__/")
    || file.includes("/fixtures/")
    || /\.env\.example$/.test(file)
    || file.endsWith(".example");
}

const { stdout } = await execFileP("git", ["ls-files", "-z"]);
const files = stdout.split("\0").filter((file) => file.length > 0);

const findings = [];
const scanned = [];

for (const file of files) {
  if (file === "package-lock.json") continue;
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue; // binary
  scanned.push(file);
  const lines = content.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of tokenPatterns) {
      for (const match of line.matchAll(pattern.re)) {
        findings.push(`${file}:${index + 1}: ${pattern.name} (${match[0]})`);
      }
    }
    if (!isNonCodeFixture(file)) {
      for (const match of line.matchAll(assignmentPattern.re)) {
        if (SYNTHETIC.test(match[2])) continue;
        findings.push(`${file}:${index + 1}: ${assignmentPattern.name} (${match[1]}${match[2]}${match[1]})`);
      }
    }
  }
}

if (findings.length > 0) {
  process.stderr.write("Secret scan failed:\n");
  for (const finding of findings) process.stderr.write(`  ${finding}\n`);
  process.exit(1);
}
process.stdout.write(`Secret scan passed across ${scanned.length} tracked files\n`);
