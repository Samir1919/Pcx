/**
 * Guard: a slice that changes a browser-facing page or flow MUST leave
 * committed, headed-browser verification evidence.
 *
 * Detects whether the current slice touches `apps/web` or `apps/admin`
 * (excluding their test directories), and if so, requires a valid
 * `docs/verify/browser-verify.json` record with:
 *   - headed === true  (a real, visible window — see PORTABLE_AGENT_WORKFLOW.md)
 *   - result === "passed"
 *   - non-empty scope, tool, and businessFlow.subject/steps
 *
 * This turns the "real headed browser check is mandatory" rule from prose into
 * an enforced gate inside `npm run verify`.
 *
 * Exit codes (only when run directly):
 *   0 — UI surface unchanged, or valid headed evidence present
 *   1 — UI surface changed but evidence missing/invalid (with actionable detail)
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readEvidence } from "./browser-verify-evidence.mjs";

export const UI_SURFACES = ["apps/web/", "apps/admin/"];
// Tests and static config do not, by themselves, constitute a user-visible
// flow change. They are excluded so a purely-internal change (e.g. a unit test
// or a build config tweak) is not forced to run a visible-browser session.
export const EXCLUDE = /(^|\/)(test|__tests__)\/|\.test\.|\.spec\.|next\.config\.|package\.json$/;

export function classifyUiFiles(files) {
  return [...files].filter(
    (f) => UI_SURFACES.some((surface) => f.startsWith(surface)) && !EXCLUDE.test(f)
  );
}

// Trim only trailing newlines/CR so a `git status --short` first line keeps its
// leading status column (e.g. " M apps/…"). A full .trim() there would strip the
// leading space and break the slice(3) filename parse below.
export function trimTrailingNewlines(value) {
  return typeof value === "string" ? value.replace(/[\r\n]+$/, "") : value;
}

function git(args) {
  return trimTrailingNewlines(execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
}

export function collectChangedFiles({ runGit = git, runStatus = () => "" } = {}) {
  const files = new Set();

  // Committed slice diff vs origin/main (the authoritative comparison).
  try {
    for (const line of runGit(["diff", "--name-only", "origin/main...HEAD"]).split("\n")) {
      if (line) files.add(line);
    }
  } catch {
    // Fall back to all branches reachable from origin if the triple-dot form is
    // unavailable in a shallow clone; primary path is the diff above.
    for (const line of runGit(["diff", "--name-only", "HEAD"]).split("\n")) {
      if (line) files.add(line);
    }
  }

  // Working tree + staged changes not yet committed.
  for (const line of runStatus().split("\n")) {
    const file = line.slice(3).trim();
    if (file) files.add(file);
  }

  return files;
}

export function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return "evidence file docs/verify/browser-verify.json is missing or not valid JSON";
  }
  const problems = [];
  if (evidence.headed !== true) problems.push("headed must be true (real visible browser, PCX_HEADED=1 or Playwright MCP headed)");
  if (evidence.result !== "passed") problems.push(`result must be "passed" (got "${evidence.result}")`);
  if (!evidence.scope?.trim()) problems.push("scope is empty");
  if (!evidence.tool?.trim()) problems.push("tool is empty");
  if (!evidence.businessFlow?.subject?.trim()) problems.push("businessFlow.subject is empty");
  if (!Array.isArray(evidence.businessFlow?.steps) || evidence.businessFlow.steps.length === 0) {
    problems.push("businessFlow.steps must list the full start-to-end flow exercised");
  }
  return problems.length ? `invalid evidence: ${problems.join("; ")}` : null;
}

async function runGuard({ collect, read }) {
  const changedUi = classifyUiFiles(collect());
  if (changedUi.length === 0) {
    return { ok: true, changed: [], problem: null };
  }
  const problem = validateEvidence(await read());
  return { ok: !problem, changed: changedUi, problem };
}

// Only execute the gate when run as a script, never on import (so the pure
// helpers above stay unit-testable).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, changed, problem } = await runGuard({
    collect: () => collectChangedFiles({ runStatus: () => git(["status", "--short", "--untracked-files=all"]) }),
    read: () => readEvidence()
  });

  if (ok) {
    if (changed.length === 0) {
      process.stdout.write("[ui-guard] OK: no browser-facing change in this slice (apps/web|apps/admin).\n");
    } else {
      process.stdout.write(`[ui-guard] OK: headed browser evidence accepted.\n`);
    }
    process.exit(0);
  }

  process.stderr.write("[ui-guard] FAIL: browser-facing files changed, but headed verification evidence is missing/invalid.\n");
  process.stderr.write("[ui-guard] Changed UI files:\n");
  for (const f of changed) process.stderr.write(`    - ${f}\n`);
  process.stderr.write(`[ui-guard] Reason: ${problem}\n`);
  process.stderr.write(
    "[ui-guard] Action: run the affected flow in a real headed browser (PCX_HEADED=1 node scripts/business-e2e-check.mjs, " +
    "node scripts/admin-e2e-check.mjs, node scripts/storefront-e2e-check.mjs, or the Playwright MCP headed), " +
    "then commit the docs/verify/browser-verify.json it writes.\n"
  );
  process.exit(1);
}
