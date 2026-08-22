/**
 * Merge/push gate: prevents the recurring "work stayed on an unmerged feature
 * branch" failure. After a slice is committed, this checks that the current
 * branch's work is either already on `main` (or its remote), or that the branch
 * has been pushed with a non-empty diff vs `main`. It fails with a clear,
 * actionable message — never a silent skip.
 *
 * Usage:
 *   node scripts/merge-gate.mjs
 *
 * Exit codes:
 *   0 — safe (already merged, or pushed and ready to merge/PR)
 *   1 — latest commit exists locally only (not pushed)
 *   2 — branch not merged into main and not pushed (or unknown state)
 */
import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

const mainBranch = "main";
const current = git(["rev-parse", "--abbrev-ref", "HEAD"]);

// Latest local commit for the branch.
const head = git(["rev-parse", headRefFor(current)]);

function headRefFor(branch) {
  return branch;
}

// Tracked remote (or null).
let remoteRef = null;
try {
  remoteRef = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${current}@{upstream}`]);
} catch {
  remoteRef = null;
}

let pushed = false;
if (remoteRef) {
  try {
    pushed = git(["rev-parse", remoteRef]) === head;
  } catch {
    pushed = false;
  }
}

// Is every commit on the current branch reachable from origin/main?
let mergedIntoMain = false;
try {
  git(["merge-base", "--is-ancestor", head, `origin/${mainBranch}`]);
  mergedIntoMain = true;
} catch {
  mergedIntoMain = false;
}

if (mergedIntoMain) {
  process.stdout.write(`[merge-gate] OK: ${current} is merged into origin/${mainBranch}.\n`);
  process.exit(0);
}

if (pushed) {
  process.stdout.write(`[merge-gate] PUSHED-ONLY: ${current} is pushed (${remoteRef}) but NOT merged into ${mainBranch}.\n`);
  process.stdout.write(`[merge-gate] Action required: open/merge a PR into ${mainBranch} (or fast-forward merge), then push ${mainBranch}.\n`);
  process.exit(1);
}

process.stdout.write(`[merge-gate] BLOCKED: ${current} latest commit (${head.slice(0, 8)}) is neither pushed nor merged into ${mainBranch}.\n`);
process.stdout.write(`[merge-gate] Action required: git push, then merge into ${mainBranch}.\n`);
process.exit(2);
