import assert from "node:assert/strict";
import test from "node:test";
import { classifyUiFiles, collectChangedFiles, validateEvidence } from "./browser-verify-guard.mjs";

function validEvidence(overrides = {}) {
  return {
    scope: "acquisition sell-request flow",
    headed: true,
    tool: "business-e2e-check.mjs",
    result: "passed",
    businessFlow: {
      subject: "Sell-to-PCX admin acquisition",
      steps: ["create sell request", "admin view in acquisition queue", "create offer"]
    },
    ranAt: "2026-08-25T15:00:00.000Z",
    ...overrides
  };
}

test("classifyUiFiles keeps web/admin sources and drops tests/config", () => {
  const files = [
    "apps/web/app/page.js",
    "apps/admin/app/page.js",
    "apps/web/test/foo.test.mjs",
    "apps/admin/test/bar.test.mjs",
    "apps/web/next.config.mjs",
    "apps/web/package.json",
    "apps/api/src/index.mjs"
  ];
  assert.deepEqual(classifyUiFiles(files), ["apps/web/app/page.js", "apps/admin/app/page.js"]);
});

test("collectChangedFiles merges committed diff and working-tree status, deduped", () => {
  const files = collectChangedFiles({
    runGit: (args) => {
      if (args[0] === "diff") {
        return "apps/web/app/page.js\napps/admin/app/shell.js\napps/web/test/x.test.mjs\n";
      }
      return "";
    },
    runStatus: () => " M apps/web/app/extra.js\n M apps/web/app/page.js\n"
  });
  assert.deepEqual([...files].sort(), [
    "apps/admin/app/shell.js",
    "apps/web/app/extra.js",
    "apps/web/app/page.js",
    "apps/web/test/x.test.mjs"
  ]);
});

test("validateEvidence accepts a complete headed passed record", () => {
  assert.equal(validateEvidence(validEvidence()), null);
});

test("validateEvidence rejects missing evidence", () => {
  assert.match(validateEvidence(null), /missing or not valid JSON/);
});

test("validateEvidence rejects non-headed evidence", () => {
  assert.match(validateEvidence(validEvidence({ headed: false })), /headed must be true/);
});

test("validateEvidence rejects a failed result", () => {
  assert.match(validateEvidence(validEvidence({ result: "failed" })), /result must be "passed"/);
});

test("validateEvidence rejects empty scope, tool, subject, or steps", () => {
  const message = validateEvidence(validEvidence({
    scope: "",
    tool: "",
    businessFlow: { subject: "", steps: [] }
  }));
  assert.match(message, /scope is empty/);
  assert.match(message, /tool is empty/);
  assert.match(message, /businessFlow\.subject is empty/);
  assert.match(message, /businessFlow\.steps/);
});
